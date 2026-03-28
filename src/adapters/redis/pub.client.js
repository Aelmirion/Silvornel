'use strict';

class PubClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async publish(_channel, _message) {}
}

module.exports = { PubClient };
