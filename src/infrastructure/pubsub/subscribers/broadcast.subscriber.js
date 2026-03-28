'use strict';

class BroadcastSubscriber {
  constructor({ subClient }) {
    this.subClient = subClient;
  }

  async register() {}
}

module.exports = { BroadcastSubscriber };
