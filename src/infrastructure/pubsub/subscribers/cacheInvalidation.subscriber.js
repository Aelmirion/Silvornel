'use strict';

class CacheInvalidationSubscriber {
  constructor({ subClient, l1Cache }) {
    this.subClient = subClient;
    this.l1Cache = l1Cache;
  }

  async register() {}
}

module.exports = { CacheInvalidationSubscriber };
