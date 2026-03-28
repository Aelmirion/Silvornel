'use strict';

class CacheClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async get(_key) { return null; }
  async set(_key, _value, _ttlSeconds) {}
  async del(_key) {}
}

module.exports = { CacheClient };
