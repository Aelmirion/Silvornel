'use strict';

class QueueService {
  constructor({ queueClient, envConfig, logger }) {
    this.queueClient = queueClient;
    this.envConfig = envConfig;
    this.logger = logger;
  }

  async enqueue(queueName, job) {
    const queueLength = await this.queueClient.length(queueName);
    if (queueLength >= this.envConfig.queue.maxLength) {
      this.logger?.warn?.('Queue backpressure threshold reached', {
        correlationId: job?.correlationId || job?.traceId || null,
        causationId: job?.causationId || null,
        userId: job?.userId || null,
        guildId: job?.guildId || null,
        queueName,
        queueLength,
        maxLength: this.envConfig.queue.maxLength
      });
      throw new Error(`Queue backpressure: ${queueName} has reached max length ${this.envConfig.queue.maxLength}`);
    }

    this.logger?.info?.('Queue job enqueued', {
      correlationId: job?.correlationId || job?.traceId || null,
      causationId: job?.causationId || null,
      userId: job?.userId || null,
      guildId: job?.guildId || null,
      queueName
    });
    await this.queueClient.enqueue(queueName, job);
  }
}

module.exports = { QueueService };
