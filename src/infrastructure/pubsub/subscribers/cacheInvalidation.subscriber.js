'use strict';

const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { CACHE_KEYS } = require('../../../config/constants/cache.keys');
const { EVENT_SCHEMA } = require('../../../config/constants/event.schema');

class CacheInvalidationSubscriber {
  constructor({ subClient, l1Cache }) {
    this.subClient = subClient;
    this.l1Cache = l1Cache;
  }

  async register() {
    await this.subClient.subscribe(REDIS_CHANNELS.cacheInvalidate, async (message) => {
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;
      const envelope = parsed?.payload ? parsed : { version: 1, type: 'cache.invalidate', payload: parsed };
      if (!EVENT_SCHEMA.supported.includes(envelope.version)) {
        return;
      }

      const key = this.deriveCacheKey(envelope.payload);
      if (!key) return;
      this.l1Cache.del(key);
    });
  }

  deriveCacheKey(payload) {
    if (payload?.key) {
      return payload.key;
    }

    if (payload?.entity === 'warnings' && payload?.guildId && payload?.userId) {
      return CACHE_KEYS.warningsByUser(payload.guildId, payload.userId);
    }

    if (payload?.userId) {
      return CACHE_KEYS.userProfile(payload.userId);
    }

    return null;
  }
}

module.exports = { CacheInvalidationSubscriber };
