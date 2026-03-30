'use strict';

class WarningCacheRepository {
  constructor({ cacheService }) {
    this.cacheService = cacheService;
  }

  createCacheKey(guildId, userId) {
    return `v1:guild:${guildId}:user:${userId}:warnings`;
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
}

module.exports = { WarningCacheRepository };
