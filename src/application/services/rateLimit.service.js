'use strict';

class RateLimitService {
  constructor({ rateLimitClient }) {
    this.rateLimitClient = rateLimitClient;
  }

  async enforce(_ctx) {}
}

module.exports = { RateLimitService };
