'use strict';

const { randomUUID } = require('crypto');
const { Warning } = require('../../../domain/models/Warning');
const { evaluateModerationActionByWarnings } = require('../../../domain/rules/moderation.rules');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { EVENT_SCHEMA } = require('../../../config/constants/event.schema');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');

class ModerationService {
  constructor({ warningRepository, warningCacheRepository, pubSubService, queueService, logger, transactionManager }) {
    this.warningRepository = warningRepository;
    this.warningCacheRepository = warningCacheRepository;
    this.pubSubService = pubSubService;
    this.queueService = queueService;
    this.logger = logger;
    this.transactionManager = transactionManager;
    this.warningsTtlSeconds = 180;
  }

  buildLogContext(dto, extra = {}) {
    return {
      correlationId: dto?.correlationId || null,
      causationId: dto?.causationId || dto?.correlationId || null,
      userId: dto?.targetUserId || dto?.moderatorId || null,
      guildId: dto?.guildId || null,
      ...extra
    };
  }

  async publishWarningsInvalidation(dto) {
    if (!this.pubSubService) {
      return;
    }

    await this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, 'cache.invalidate', {
      eventId: randomUUID(),
      guildId: dto.guildId,
      userId: dto.targetUserId,
      entity: 'warnings',
      originShard: process.env.SHARD_ID || '0'
    }, {
      correlationId: dto.correlationId || null,
      causationId: dto.causationId || dto.correlationId || null,
      schemaVersion: EVENT_SCHEMA.current
    });
  }

  async runStep(stepName, dto, executor) {
    try {
      return await executor();
    } catch (error) {
      this.logger?.error?.('Moderation flow step failed', this.buildLogContext(dto, {
        stepName,
        error: error.message
      }));
      throw new Error(`Moderation flow failed at "${stepName}": ${error.message}`, { cause: error });
    }
  }

  async warnUser(dto) {
    this.logger?.info?.('Moderation action started', this.buildLogContext(dto, {
      action: 'warn',
      moderatorId: dto.moderatorId
    }));

    const accepted = await this.warningRepository.registerModerationAction({
      moderationActionId: dto.moderationActionId,
      guildId: dto.guildId,
      userId: dto.targetUserId,
      actionType: dto.action,
      correlationId: dto.correlationId,
      causationId: dto.causationId
    });
    if (!accepted) {
      this.logger?.warn?.('Duplicate moderation action suppressed', this.buildLogContext(dto, {
        action: 'warn',
        moderationActionId: dto.moderationActionId
      }));
      return this.buildWarningsResponse(dto, await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId), 'idempotent');
    }

    const cacheInvalidationEvent = {
      eventId: randomUUID(),
      guildId: dto.guildId,
      userId: dto.targetUserId,
      entity: 'warnings',
      originShard: process.env.SHARD_ID || '0'
    };
    const warning = await this.runStep('db_write_warning', dto, async () => this.transactionManager.runInTransaction(async (tx) => {
      const createdWarning = await this.warningRepository.createWarning(new Warning({
        guildId: dto.guildId,
        userId: dto.targetUserId,
        moderatorId: dto.moderatorId,
        reason: dto.reason
      }), tx);

      await this.warningRepository.createOutboxEvent({
        eventId: cacheInvalidationEvent.eventId,
        destination: REDIS_CHANNELS.cacheInvalidate,
        eventType: 'cache.invalidate',
        payload: cacheInvalidationEvent,
        correlationId: dto.correlationId,
        causationId: dto.causationId || dto.correlationId || null
      }, tx);

      return createdWarning;
    }));

    await this.runStep('cache_invalidation', dto, async () => {
      if (this.warningCacheRepository) {
        await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
        this.warningCacheRepository.markRecentWrite(dto.guildId, dto.targetUserId);
      }
    });
    await this.runStep('pubsub_publish', dto, async () => this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, 'cache.invalidate', cacheInvalidationEvent, {
      correlationId: dto.correlationId || null,
      causationId: dto.causationId || dto.correlationId || null
    }));
    await this.warningRepository.markOutboxPublished(cacheInvalidationEvent.eventId);

    const warnings = await this.runStep('db_read_warnings', dto, async () => this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId));
    const warningCount = warnings.length;
    const moderationRule = evaluateModerationActionByWarnings(warningCount);

    if (moderationRule && this.queueService) {
      await this.runStep('queue_enqueue', dto, async () => this.queueService.enqueue(QUEUE_NAMES.moderation, {
        type: 'moderation_action',
        userId: dto.targetUserId,
        guildId: dto.guildId,
        action: moderationRule.action,
        reason: moderationRule.reason,
        moderationActionId: dto.moderationActionId,
        correlationId: dto.correlationId || null,
        causationId: dto.causationId || dto.correlationId || null,
        traceId: dto.traceId || dto.correlationId || randomUUID()
      }));
    }

    this.logger?.info?.('Moderation action completed', this.buildLogContext(dto, {
      action: 'warn',
      warningId: warning.id,
      warningCount,
      moderationAction: moderationRule?.action || null
    }));

    return {
      kind: 'interaction.response',
      data: {
        content: moderationRule
          ? `⚠️ Warned <@${dto.targetUserId}>.\nReason: ${warning.reason}\nThreshold action queued: ${moderationRule.action}.`
          : `⚠️ Warned <@${dto.targetUserId}>.\nReason: ${warning.reason}`
      },
      meta: {
        action: 'warn',
        targetUserId: dto.targetUserId,
        warningId: warning.id,
        warningCount,
        moderationAction: moderationRule?.action || null
      }
    };
  }

  async getWarnings(dto) {
    this.logger?.info?.('Moderation action started', this.buildLogContext(dto, {
      action: 'warnings',
      moderatorId: dto.moderatorId
    }));

    if (this.warningCacheRepository) {
      const cachedWarnings = await this.warningCacheRepository.getWarningsSingleFlight(
        dto.guildId,
        dto.targetUserId,
        async () => this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId),
        this.warningsTtlSeconds
      );
      if (Array.isArray(cachedWarnings)) {
        this.logger?.info?.('Moderation action completed', this.buildLogContext(dto, {
          action: 'warnings',
          source: 'cache',
          warningCount: cachedWarnings.length
        }));
        return this.buildWarningsResponse(dto, cachedWarnings, 'cache');
      }
    }

    const warnings = await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId);

    this.logger?.info?.('Moderation action completed', this.buildLogContext(dto, {
      action: 'warnings',
      source: 'db',
      warningCount: warnings.length
    }));

    return this.buildWarningsResponse(dto, warnings, 'db');
  }

  buildWarningsResponse(dto, warnings, source) {
    if (warnings.length === 0) {
      return {
        kind: 'interaction.response',
        data: {
          content: `✅ <@${dto.targetUserId}> has no warnings.`
        },
        meta: { action: 'warnings', targetUserId: dto.targetUserId, count: 0, source }
      };
    }

    const lines = warnings.map((warning, index) => `${index + 1}. ${warning.reason}`);

    return {
      kind: 'interaction.response',
      data: {
        content: `📋 Warnings for <@${dto.targetUserId}> (${warnings.length})\n${lines.join('\n')}`
      },
      meta: { action: 'warnings', targetUserId: dto.targetUserId, count: warnings.length, source }
    };
  }

  async clearWarnings(dto) {
    this.logger?.info?.('Moderation action started', this.buildLogContext(dto, {
      action: 'clearwarnings',
      moderatorId: dto.moderatorId
    }));

    const accepted = await this.warningRepository.registerModerationAction({
      moderationActionId: dto.moderationActionId,
      guildId: dto.guildId,
      userId: dto.targetUserId,
      actionType: dto.action,
      correlationId: dto.correlationId,
      causationId: dto.causationId
    });
    if (!accepted) {
      this.logger?.warn?.('Duplicate moderation action suppressed', this.buildLogContext(dto, {
        action: 'clearwarnings',
        moderationActionId: dto.moderationActionId
      }));
      return this.buildWarningsResponse(dto, await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId), 'idempotent');
    }

    const cacheInvalidationEvent = {
      eventId: randomUUID(),
      guildId: dto.guildId,
      userId: dto.targetUserId,
      entity: 'warnings',
      originShard: process.env.SHARD_ID || '0'
    };
    const deletedCount = await this.runStep('db_delete_warnings', dto, async () => this.transactionManager.runInTransaction(async (tx) => {
      const deleted = await this.warningRepository.deleteWarningsByUser(dto.guildId, dto.targetUserId, tx);
      await this.warningRepository.createOutboxEvent({
        eventId: cacheInvalidationEvent.eventId,
        destination: REDIS_CHANNELS.cacheInvalidate,
        eventType: 'cache.invalidate',
        payload: cacheInvalidationEvent,
        correlationId: dto.correlationId,
        causationId: dto.causationId || dto.correlationId || null
      }, tx);
      return deleted;
    }));

    await this.runStep('cache_invalidation', dto, async () => {
      if (this.warningCacheRepository) {
        await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
        this.warningCacheRepository.markRecentWrite(dto.guildId, dto.targetUserId);
      }
    });
    await this.runStep('pubsub_publish', dto, async () => this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, 'cache.invalidate', cacheInvalidationEvent, {
      correlationId: dto.correlationId || null,
      causationId: dto.causationId || dto.correlationId || null
    }));
    await this.warningRepository.markOutboxPublished(cacheInvalidationEvent.eventId);

    this.logger?.info?.('Moderation action completed', this.buildLogContext(dto, {
      action: 'clearwarnings',
      deletedCount
    }));

    return {
      kind: 'interaction.response',
      data: {
        content: `🧹 Cleared ${deletedCount} warning(s) for <@${dto.targetUserId}>.`
      },
      meta: { action: 'clearwarnings', targetUserId: dto.targetUserId, deletedCount }
    };
  }

  async execute(dto) {
    if (dto.action === 'warn') {
      return this.warnUser(dto);
    }

    if (dto.action === 'warnings') {
      return this.getWarnings(dto);
    }

    return this.clearWarnings(dto);
  }
}

module.exports = { ModerationService };
