'use strict';

class QueueService {
  constructor({ queueClient, envConfig }) {
    this.queueClient = queueClient;
    this.envConfig = envConfig;
  }

  async enqueue(queueName, job) {
    const queueLength = await this.queueClient.length(queueName);
    if (queueLength >= this.envConfig.queue.maxLength) {
      throw new Error(`Queue backpressure: ${queueName} has reached max length ${this.envConfig.queue.maxLength}`);
    }

    await this.queueClient.enqueue(queueName, job);
  }
}

module.exports = { QueueService };
