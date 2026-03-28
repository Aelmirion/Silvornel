'use strict';

class PubClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async publish(channel, message) {
    return this.circuitBreaker.execute(async () => this.redisClient.publish(channel, message));
  }
}

module.exports = { PubClient };
