'use strict';

class RateLimitService {
  constructor({ rateLimitClient }) {
    this.rateLimitClient = rateLimitClient;
  }

  async enforce(ctx) {
    if (!ctx || !ctx.userId || !ctx.commandName) {
      return;
    }

    await this.rateLimitClient.consume(`v1:rl:user:${ctx.userId}:cmd:${ctx.commandName}`, 5, 10);
  }
}

module.exports = { RateLimitService };
