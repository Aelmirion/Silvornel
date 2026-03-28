'use strict';

class SubClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
  }

  async subscribe(channel, handler) {
    return this.circuitBreaker.execute(async () => this.redisClient.subscribe(channel, handler));
  }
}

module.exports = { SubClient };
