'use strict';

const { DomainError } = require('../../core/errors/DomainError');

const DEFAULT_COOLDOWN_MS = 2_000;
const cooldownCache = new Map();

async function cooldownMiddleware(ctx, next) {
  if (!ctx?.userId || !ctx?.commandName || !ctx?.guildId) {
    return next(ctx);
  }

  const cooldownKey = `${ctx.userId}:${ctx.guildId}:${ctx.commandName}`;
  const now = Date.now();
  const cooldownUntil = cooldownCache.get(cooldownKey) || 0;

  if (now < cooldownUntil) {
    const retryAfterMs = cooldownUntil - now;
    throw new DomainError(
      `Command is on cooldown. Retry in ${Math.ceil(retryAfterMs / 1000)}s.`,
      'COMMAND_COOLDOWN'
    );
  }

  cooldownCache.set(cooldownKey, now + DEFAULT_COOLDOWN_MS);
  return next(ctx);
}

module.exports = { cooldownMiddleware };
