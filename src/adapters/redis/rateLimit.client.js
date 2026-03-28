'use strict';

class RateLimitClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async consume(_key, _limit, _windowSeconds) {
    return { allowed: true, remaining: _limit };
  }
}

module.exports = { RateLimitClient };
