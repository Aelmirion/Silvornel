'use strict';

class CacheClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async get(key) {
    return this.circuitBreaker.execute(async () => this.redisClient.get(key));
  }

  async set(key, value, ttlSeconds) {
    return this.circuitBreaker.execute(async () => this.redisClient.set(key, value, { EX: ttlSeconds }));
  }

  async del(key) {
    return this.circuitBreaker.execute(async () => this.redisClient.del(key));
  }
}

module.exports = { CacheClient };
