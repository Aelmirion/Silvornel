'use strict';

const { randomUUID } = require('crypto');
const { Warning } = require('../../../domain/models/Warning');
const { evaluateModerationActionByWarnings } = require('../../../domain/rules/moderation.rules');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { EVENT_SCHEMA } = require('../../../config/constants/event.schema');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');

class ModerationService {
  constructor({ warningRepository, warningCacheRepository, pubSubService, queueService }) {
    this.warningRepository = warningRepository;
    this.warningCacheRepository = warningCacheRepository;
    this.pubSubService = pubSubService;
    this.queueService = queueService;
    this.warningsTtlSeconds = 180;
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

  async warnUser(dto) {
    const warning = await this.warningRepository.createWarning(new Warning({
      guildId: dto.guildId,
      userId: dto.targetUserId,
      moderatorId: dto.moderatorId,
      reason: dto.reason
    }));

    if (this.warningCacheRepository) {
      await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
    }
    await this.publishWarningsInvalidation(dto);
    const warnings = await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId);
    const warningCount = warnings.length;
    const moderationRule = evaluateModerationActionByWarnings(warningCount);

    if (moderationRule && this.queueService) {
      await this.queueService.enqueue(QUEUE_NAMES.moderation, {
        type: 'moderation_action',
        userId: dto.targetUserId,
        guildId: dto.guildId,
        action: moderationRule.action,
        reason: moderationRule.reason,
        traceId: dto.traceId || randomUUID()
      });
    }

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
    if (this.warningCacheRepository) {
      const cachedWarnings = await this.warningCacheRepository.getWarnings(dto.guildId, dto.targetUserId);
      if (Array.isArray(cachedWarnings)) {
        return this.buildWarningsResponse(dto, cachedWarnings, 'cache');
      }
    }

    const warnings = await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId);

    if (this.warningCacheRepository) {
      await this.warningCacheRepository.setWarnings(dto.guildId, dto.targetUserId, warnings, this.warningsTtlSeconds);
    }

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
    const deletedCount = await this.warningRepository.deleteWarningsByUser(dto.guildId, dto.targetUserId);

    if (this.warningCacheRepository) {
      await this.warningCacheRepository.deleteWarnings(dto.guildId, dto.targetUserId);
    }
    await this.publishWarningsInvalidation(dto);

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
