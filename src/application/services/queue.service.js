'use strict';

class QueueService {
  constructor({ queueClient }) {
    this.queueClient = queueClient;
  }

  async enqueue(_queueName, _job) {}
}

module.exports = { QueueService };
