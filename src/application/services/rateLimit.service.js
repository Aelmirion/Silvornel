'use strict';

const { DomainError } = require('../../core/errors/DomainError');

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local windowSeconds = tonumber(ARGV[1])

local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, windowSeconds)
end

local ttl = redis.call('TTL', key)
return { current, ttl }
`;

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

    const executeConsume = async () => this.rateLimitClient.redisClient.eval(RATE_LIMIT_LUA, {
      keys: [key],
      arguments: [String(this.windowSeconds)]
    });

    const result = await this.rateLimitClient.circuitBreaker.execute(
      executeConsume,
      { label: `redis.rateLimit.consume:${ctx.commandName}` }
    );

    const current = Number(result?.[0] || 0);
    const ttlSeconds = Math.max(0, Number(result?.[1] || 0));
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
