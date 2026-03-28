'use strict';

class RetryConsumer {
  constructor({ queueClient }) {
    this.queueClient = queueClient;
  }

  async start() {}
}

module.exports = { RetryConsumer };
