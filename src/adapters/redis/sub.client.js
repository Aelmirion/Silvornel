'use strict';

class SubClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async subscribe(_channel, _handler) {}
}

module.exports = { SubClient };
