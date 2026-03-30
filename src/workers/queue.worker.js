'use strict';

class QueueWorker {
  constructor({ moderationConsumer, retryConsumer }) {
    this.moderationConsumer = moderationConsumer;
    this.retryConsumer = retryConsumer;
  }

  async start() {
    const workers = [];

    if (this.moderationConsumer?.start) {
      workers.push(this.moderationConsumer.start());
    }

    if (this.retryConsumer?.start) {
      workers.push(this.retryConsumer.start());
    }

    await Promise.all(workers);
  }
}

module.exports = { QueueWorker };
