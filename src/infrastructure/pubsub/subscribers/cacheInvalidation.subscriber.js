'use strict';

const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');

class CacheInvalidationSubscriber {
  constructor({ subClient, l1Cache }) {
    this.subClient = subClient;
    this.l1Cache = l1Cache;
  }

  async register() {
    await this.subClient.subscribe(REDIS_CHANNELS.cacheInvalidate, async (message) => {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      if (!payload?.key) return;
      this.l1Cache.del(payload.key);
    });
  }
}

module.exports = { CacheInvalidationSubscriber };
