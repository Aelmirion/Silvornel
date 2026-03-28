'use strict';

const { CACHE_KEYS } = require('../../config/constants/cache.keys');

class UserCacheRepository {
  constructor({ cacheService }) {
    this.cacheService = cacheService;
  }

  createCacheKey(userId) {
    return CACHE_KEYS.userProfile(userId);
  }

  async get(userId) {
    return this.cacheService.get(this.createCacheKey(userId));
  }

  async set(profile, ttlSeconds = 180) {
    return this.cacheService.set(this.createCacheKey(profile.userId), profile, ttlSeconds);
  }

  async invalidate(userId) {
    return this.cacheService.invalidate(this.createCacheKey(userId));
  }
}

module.exports = { UserCacheRepository };
