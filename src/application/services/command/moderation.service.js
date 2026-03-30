'use strict';

const { Warning } = require('../../../domain/models/Warning');

class ModerationService {
  constructor({ warningRepository }) {
    this.warningRepository = warningRepository;
  }

  async warnUser(dto) {
    const warning = await this.warningRepository.createWarning(new Warning({
      guildId: dto.guildId,
      userId: dto.targetUserId,
      moderatorId: dto.moderatorId,
      reason: dto.reason
    }));

    return {
      kind: 'interaction.response',
      data: {
        content: `⚠️ Warned <@${dto.targetUserId}>.\nReason: ${warning.reason}`
      },
      meta: { action: 'warn', targetUserId: dto.targetUserId, warningId: warning.id }
    };
  }

  async getWarnings(dto) {
    const warnings = await this.warningRepository.getWarningsByUser(dto.guildId, dto.targetUserId);

    if (warnings.length === 0) {
      return {
        kind: 'interaction.response',
        data: {
          content: `✅ <@${dto.targetUserId}> has no warnings.`
        },
        meta: { action: 'warnings', targetUserId: dto.targetUserId, count: 0 }
      };
    }

    const lines = warnings.map((warning, index) => `${index + 1}. ${warning.reason}`);

    return {
      kind: 'interaction.response',
      data: {
        content: `📋 Warnings for <@${dto.targetUserId}> (${warnings.length})\n${lines.join('\n')}`
      },
      meta: { action: 'warnings', targetUserId: dto.targetUserId, count: warnings.length }
    };
  }

  async clearWarnings(dto) {
    const deletedCount = await this.warningRepository.deleteWarningsByUser(dto.guildId, dto.targetUserId);

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
