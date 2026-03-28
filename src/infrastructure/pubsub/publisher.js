'use strict';

class Publisher {
  constructor({ pubClient }) {
    this.pubClient = pubClient;
  }

  async publish(channel, payload) {
    return this.pubClient.publish(channel, JSON.stringify(payload));
  }
}

module.exports = { Publisher };
