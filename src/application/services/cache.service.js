'use strict';

class CacheService {
  constructor({ l1Cache, cacheClient }) {
    this.l1Cache = l1Cache;
    this.cacheClient = cacheClient;
    this.inFlightLoads = new Map();
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
    // required order: L2 first, then local L1
    await this.cacheClient.del(key);
    this.l1Cache.del(key);
  }

  markRecentWriteBypass(key, ttlSeconds = 2) {
    this.l1Cache.set(`bypass:${key}`, true, ttlSeconds);
  }

  shouldBypassRead(key) {
    return Boolean(this.l1Cache.get(`bypass:${key}`));
  }

  async getOrLoad(key, loader, { ttlSeconds = 180, singleFlight = false, bypassRecentWrite = false } = {}) {
    if (!bypassRecentWrite && !this.shouldBypassRead(key)) {
      const cached = await this.get(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    }

    if (!singleFlight) {
      const loaded = await loader();
      await this.set(key, loaded, ttlSeconds);
      return loaded;
    }

    const existingInFlight = this.inFlightLoads.get(key);
    if (existingInFlight) {
      return existingInFlight;
    }

    const loadPromise = (async () => {
      const loaded = await loader();
      await this.set(key, loaded, ttlSeconds);
      return loaded;
    })();

    this.inFlightLoads.set(key, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inFlightLoads.delete(key);
    }
  }
}

module.exports = { CacheService };
