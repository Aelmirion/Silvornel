'use strict';

const { DomainError } = require('../../core/errors/DomainError');
const { validateWarningReason } = require('../rules/moderation.rules');

class Warning {
  constructor({ id = null, guildId, userId, moderatorId, reason, createdAt = null }) {
    if (!guildId || typeof guildId !== 'string') {
      throw new DomainError('Warning guildId is required', 'WARNING_INVALID_GUILD_ID');
    }

    if (!userId || typeof userId !== 'string') {
      throw new DomainError('Warning userId is required', 'WARNING_INVALID_USER_ID');
    }

    if (!moderatorId || typeof moderatorId !== 'string') {
      throw new DomainError('Warning moderatorId is required', 'WARNING_INVALID_MODERATOR_ID');
    }

    this.id = id;
    this.guildId = guildId;
    this.userId = userId;
    this.moderatorId = moderatorId;
    this.reason = validateWarningReason(reason);
    this.createdAt = createdAt;
  }
}

module.exports = { Warning };
