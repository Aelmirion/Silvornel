'use strict';

class ModerationProducer {
  constructor({ queueService }) {
    this.queueService = queueService;
  }

  async enqueue(_job) {}
}

module.exports = { ModerationProducer };
