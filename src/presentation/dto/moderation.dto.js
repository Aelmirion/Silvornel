'use strict';

const { createHash } = require('crypto');
const { DomainError } = require('../../core/errors/DomainError');
const { validateWarningReason } = require('../../domain/rules/moderation.rules');
const { sanitizeInput } = require('../../core/security/sanitizer');

const ACTION_BY_COMMAND = Object.freeze({
  warn: 'warn',
  warnings: 'warnings',
  clearwarnings: 'clearwarnings'
});

class ModerationDto {
  constructor({ action, guildId, moderatorId, targetUserId, reason = null, correlationId = null, causationId = null, moderationActionId = null }) {
    this.action = action;
    this.guildId = guildId;
    this.moderatorId = moderatorId;
    this.targetUserId = targetUserId;
    this.reason = reason;
    this.correlationId = correlationId;
    this.causationId = causationId;
    this.moderationActionId = moderationActionId;
  }

  static fromCommand(commandDto) {
    const action = ACTION_BY_COMMAND[commandDto?.commandName];
    if (!action) {
      throw new DomainError('Unsupported moderation command', 'MODERATION_UNSUPPORTED_COMMAND');
    }

    if (!commandDto?.guildId) {
      throw new DomainError('Guild ID is required', 'MODERATION_MISSING_GUILD_ID');
    }

    if (!commandDto?.userId) {
      throw new DomainError('Moderator user ID is required', 'MODERATION_MISSING_MODERATOR_ID');
    }

    const options = commandDto.options || [];
    const targetUser = sanitizeInput(options.find((option) => option.name === 'user')?.value);

    if (!targetUser || typeof targetUser !== 'string') {
      throw new DomainError('Target user is required', 'MODERATION_MISSING_TARGET_USER');
    }

    const reasonInput = sanitizeInput(options.find((option) => option.name === 'reason')?.value);
    const normalizedReason = action === 'warn' ? validateWarningReason(reasonInput) : null;
    const correlationId = commandDto.correlationId || null;
    const causationId = commandDto.causationId || correlationId;
    const moderationActionId = createHash('sha256')
      .update(`${action}:${commandDto.guildId}:${targetUser}:${correlationId || 'none'}`)
      .digest('hex')
      .slice(0, 48);

    return new ModerationDto({
      action,
      guildId: commandDto.guildId,
      moderatorId: commandDto.userId,
      targetUserId: targetUser,
      reason: normalizedReason,
      correlationId,
      causationId,
      moderationActionId
    });
  }
}

module.exports = { ModerationDto };
