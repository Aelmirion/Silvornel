'use strict';

class PubSubService {
  constructor({ publisher, subscriber }) {
    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  async publish(_channel, _payload) {}
  async subscribe(_channel, _handler) {}
}

module.exports = { PubSubService };
