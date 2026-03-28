'use strict';

class PubSubService {
  constructor({ publisher, subscriber }) {
    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  async publish(channel, payload) {
    return this.publisher.publish(channel, payload);
  }

  async subscribe(channel, handler) {
    return this.subscriber.subscribe(channel, async (message) => {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      return handler(payload);
    });
  }
}

module.exports = { PubSubService };
