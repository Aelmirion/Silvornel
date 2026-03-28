'use strict';

class AnalyticsProducer {
  constructor({ queueService }) {
    this.queueService = queueService;
  }

  async enqueue(_job) {}
}

module.exports = { AnalyticsProducer };
