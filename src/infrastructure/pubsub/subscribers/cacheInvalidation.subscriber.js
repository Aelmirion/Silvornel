'use strict';

const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { CACHE_KEYS } = require('../../../config/constants/cache.keys');

class CacheInvalidationSubscriber {
  constructor({ subClient, l1Cache }) {
    this.subClient = subClient;
    this.l1Cache = l1Cache;
  }

  async register() {
    await this.subClient.subscribe(REDIS_CHANNELS.cacheInvalidate, async (message) => {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      const key = payload?.key || (payload?.userId ? CACHE_KEYS.userProfile(payload.userId) : null);
      if (!key) return;
      this.l1Cache.del(key);
    });
  }
}

module.exports = { CacheInvalidationSubscriber };
