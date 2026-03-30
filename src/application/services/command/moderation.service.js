'use strict';

const { Warning } = require('../../../domain/models/Warning');

class ModerationService {
  constructor({ warningRepository, warningCacheRepository }) {
    this.warningRepository = warningRepository;
    this.warningCacheRepository = warningCacheRepository;
    this.warningsTtlSeconds = 180;
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

    return {
      kind: 'interaction.response',
      data: {
        content: `⚠️ Warned <@${dto.targetUserId}>.\nReason: ${warning.reason}`
      },
      meta: { action: 'warn', targetUserId: dto.targetUserId, warningId: warning.id }
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
