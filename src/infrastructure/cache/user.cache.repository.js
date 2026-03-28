'use strict';

const { CACHE_KEYS } = require('../../config/constants/cache.keys');

class UserCacheRepository {
  constructor({ cacheService }) {
    this.cacheService = cacheService;
  }

  createCacheKey(discordId) {
    return CACHE_KEYS.userProfile(discordId);
  }

  async getProfile(discordId) {
    return this.cacheService.get(this.createCacheKey(discordId));
  }

  async setProfile(discordId, data, ttlSeconds = 180) {
    return this.cacheService.set(this.createCacheKey(discordId), data, ttlSeconds);
  }

  async deleteProfile(discordId) {
    return this.cacheService.invalidate(this.createCacheKey(discordId));
  }

  // Backward-compatible aliases
  async get(discordId) { return this.getProfile(discordId); }
  async set(profile, ttlSeconds = 180) { return this.setProfile(profile.userId, profile, ttlSeconds); }
  async invalidate(discordId) { return this.deleteProfile(discordId); }
}

module.exports = { UserCacheRepository };
