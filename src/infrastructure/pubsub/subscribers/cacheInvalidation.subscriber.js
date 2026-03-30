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
      const key = this.deriveCacheKey(payload);
      if (!key) return;
      this.l1Cache.del(key);
    });
  }

  deriveCacheKey(payload) {
    if (payload?.key) {
      return payload.key;
    }

    if (payload?.entity === 'warnings' && payload?.guildId && payload?.userId) {
      return `v1:guild:${payload.guildId}:user:${payload.userId}:warnings`;
    }

    if (payload?.userId) {
      return CACHE_KEYS.userProfile(payload.userId);
    }

    return null;
  }
}

module.exports = { CacheInvalidationSubscriber };
