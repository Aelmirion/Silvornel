'use strict';

class PingService {
  async execute(_interactionDto) {
    return { content: 'pong' };
  }
}

module.exports = { PingService };
