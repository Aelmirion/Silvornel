'use strict';

const { DomainError } = require('../../core/errors/DomainError');

class RateLimitService {
  constructor({ rateLimitClient }) {
    this.rateLimitClient = rateLimitClient;
    this.limit = 5;
    this.windowSeconds = 10;
  }

  async enforce(ctx) {
    if (!ctx || !ctx.userId || !ctx.commandName || !ctx.guildId) {
      return;
    }

    const key = `v1:rl:user:${ctx.userId}:guild:${ctx.guildId}:cmd:${ctx.commandName}`;
    const { current, ttlSeconds } = await this.rateLimitClient.consume(
      key,
      this.windowSeconds,
      { commandName: ctx.commandName }
    );
    const remaining = Math.max(0, this.limit - current);

    ctx.rateLimit = {
      key,
      current,
      limit: this.limit,
      remaining,
      windowSeconds: this.windowSeconds,
      retryAfterSeconds: ttlSeconds
    };

    if (current > this.limit) {
      throw new DomainError(
        `Rate limit exceeded. Retry in ${ttlSeconds}s.`,
        'RATE_LIMIT_EXCEEDED'
      );
    }
  }
}

module.exports = { RateLimitService };
