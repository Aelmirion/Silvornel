'use strict';

class PingController {
  constructor({ pingService }) {
    this.pingService = pingService;
  }

  async execute(interactionDto) {
    return this.pingService.execute(interactionDto);
  }
}

module.exports = { PingController };
