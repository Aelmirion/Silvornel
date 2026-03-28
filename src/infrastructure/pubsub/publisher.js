'use strict';

class Publisher {
  constructor({ pubClient }) {
    this.pubClient = pubClient;
  }

  async publish(_channel, _payload) {}
}

module.exports = { Publisher };
