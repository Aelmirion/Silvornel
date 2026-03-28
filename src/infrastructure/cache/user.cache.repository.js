'use strict';

class UserCacheRepository {
  constructor({ cacheService }) {
    this.cacheService = cacheService;
  }
}

module.exports = { UserCacheRepository };
