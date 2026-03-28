'use strict';

class CacheService {
  constructor({ l1Cache, cacheClient }) {
    this.l1Cache = l1Cache;
    this.cacheClient = cacheClient;
  }

  async get(key) {
    const l1Value = this.l1Cache.get(key);
    if (l1Value !== null && l1Value !== undefined) {
      return l1Value;
    }

    const l2Value = await this.cacheClient.get(key);
    if (l2Value === null || l2Value === undefined) {
      return null;
    }

    const parsed = typeof l2Value === 'string' ? JSON.parse(l2Value) : l2Value;
    this.l1Cache.set(key, parsed, 30);
    return parsed;
  }

  async set(key, value, ttlSeconds) {
    this.l1Cache.set(key, value, Math.min(ttlSeconds, 30));
    await this.cacheClient.set(key, JSON.stringify(value), ttlSeconds);
  }

  async invalidate(key) {
    this.l1Cache.del(key);
    await this.cacheClient.del(key);
  }
}

module.exports = { CacheService };
