'use strict';

class QueueWorker {
  constructor({ moderationConsumer, retryConsumer }) {
    this.moderationConsumer = moderationConsumer;
    this.retryConsumer = retryConsumer;
  }

  async start() {}
}

module.exports = { QueueWorker };
