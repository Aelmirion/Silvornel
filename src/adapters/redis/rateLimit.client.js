'use strict';

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

class RateLimitClient {
  constructor({ redisClient, circuitBreaker }) {
    this._redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async consume(key, windowSeconds, options = {}) {
    const commandLabel = options.commandName || 'unknown';

    const result = await this.circuitBreaker.execute(
      async () => this._redisClient.eval(RATE_LIMIT_LUA, {
        keys: [key],
        arguments: [String(windowSeconds)]
      }),
      { label: `redis.rateLimit.consume:${commandLabel}` }
    );

    const current = Number(result?.[0] || 0);
    const ttlSeconds = Math.max(0, Number(result?.[1] || 0));

    return {
      current,
      ttlSeconds
    };
  }
}

module.exports = { RateLimitClient };
