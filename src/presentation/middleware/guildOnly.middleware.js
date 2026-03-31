'use strict';

const { DomainError } = require('../../core/errors/DomainError');

async function guildOnlyMiddleware(ctx, next) {
  if (!ctx?.guildId) {
    throw new DomainError('This command can only be used inside a guild.', 'GUILD_ONLY_COMMAND');
  }

  return next(ctx);
}

module.exports = { guildOnlyMiddleware };
