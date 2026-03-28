'use strict';

class QueueClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async enqueue(_queueName, _job) {}
  async reserve(_queueName) { return null; }
  async ack(_queueName, _jobId) {}
}

module.exports = { QueueClient };
