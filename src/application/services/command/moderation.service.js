'use strict';

const { randomUUID } = require('crypto');
const { Warning } = require('../../../domain/models/Warning');
const { evaluateModerationActionByWarnings } = require('../../../domain/rules/moderation.rules');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { EVENT_SCHEMA } = require('../../../config/constants/event.schema');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');

class ModerationService {
  constructor({ warningRepository, warningCacheRepository, pubSubService, queueService, logger }) {
    this.warningRepository = warningRepository;
    this.warningCacheRepository = warningCacheRepository;
    this.pubSubService = pubSubService;
    this.queueService = queueService;
    this.logger = logger;
    this.warningsTtlSeconds = 180;
  }

  buildLogContext(dto, extra = {}) {
    return {
      correlationId: dto?.correlationId || null,
      userId: dto?.targetUserId || dto?.moderatorId || null,
      guildId: dto?.guildId || null,
      ...extra
    };
  }

  async publishWarningsInvalidation(dto) {
    if (!this.pubSubService) {
      return;
    }

    await this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, {
      eventId: randomUUID(),
      schemaVersion: EVENT_SCHEMA.current,
      guildId: dto.guildId,
      userId: dto.targetUserId,
      entity: 'warnings',
      originShard: process.env.SHARD_ID || '0'
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

    const warning = await this.runStep('db_write_warning', dto, async () => this.warningRepository.createWarning(new Warning({
      guildId: dto.guildId,
      userId: dto.targetUserId,
      moderatorId: dto.moderatorId,
      reason: dto.reason
    })));

    await this.runStep('cache_invalidation', dto, async () => {
      if (this.warningCacheRepository) {
        await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
      }
    });

    await this.runStep('pubsub_publish', dto, async () => this.publishWarningsInvalidation(dto));

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
        correlationId: dto.correlationId || null,
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
      const cachedWarnings = await this.warningCacheRepository.getWarnings(dto.guildId, dto.targetUserId);
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

    if (this.warningCacheRepository) {
      await this.warningCacheRepository.setWarnings(dto.guildId, dto.targetUserId, warnings, this.warningsTtlSeconds);
    }

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

    const deletedCount = await this.runStep('db_delete_warnings', dto, async () => this.warningRepository.deleteWarningsByUser(dto.guildId, dto.targetUserId));

    await this.runStep('cache_invalidation', dto, async () => {
      if (this.warningCacheRepository) {
        await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
      }
    });

    await this.runStep('pubsub_publish', dto, async () => this.publishWarningsInvalidation(dto));

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
