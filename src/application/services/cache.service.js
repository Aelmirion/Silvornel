'use strict';

class CacheService {
  constructor({ l1Cache, cacheClient }) {
    this.l1Cache = l1Cache;
    this.cacheClient = cacheClient;
  }

  async get(_key) { return null; }
  async set(_key, _value, _ttlSeconds) {}
  async invalidate(_key) {}
}

module.exports = { CacheService };
