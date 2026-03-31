'use strict';

const { CACHE_KEYS } = require('../../config/constants/cache.keys');

class WarningCacheRepository {
  constructor({ cacheService }) {
    this.cacheService = cacheService;
  }

  createCacheKey(guildId, userId) {
    return CACHE_KEYS.warningsByUser(guildId, userId);
  }

  async getWarnings(guildId, userId) {
    return this.cacheService.get(this.createCacheKey(guildId, userId));
  }

  async setWarnings(guildId, userId, data, ttlSeconds = 180) {
    return this.cacheService.set(this.createCacheKey(guildId, userId), data, ttlSeconds);
  }

  async deleteWarnings(guildId, userId) {
    return this.cacheService.invalidate(this.createCacheKey(guildId, userId));
  }

  markRecentWrite(guildId, userId, ttlSeconds = 2) {
    this.cacheService.markRecentWriteBypass(this.createCacheKey(guildId, userId), ttlSeconds);
  }

  async getWarningsSingleFlight(guildId, userId, loader, ttlSeconds = 180) {
    return this.cacheService.getOrLoad(this.createCacheKey(guildId, userId), loader, {
      ttlSeconds,
      singleFlight: true
    });
  }
}

module.exports = { WarningCacheRepository };
