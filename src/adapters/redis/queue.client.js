'use strict';

class QueueClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async enqueue(queueName, job) {
    return this.circuitBreaker.execute(
      async () => this.redisClient.rPush(queueName, JSON.stringify(job)),
      { label: `redis.queue.enqueue:${queueName}` }
    );
  }

  async length(queueName) {
    return this.circuitBreaker.execute(
      async () => this.redisClient.lLen(queueName),
      { label: `redis.queue.length:${queueName}` }
    );
  }

  async reserve(_queueName) { return null; }
  async ack(_queueName, _jobId) {}
}

module.exports = { QueueClient };
