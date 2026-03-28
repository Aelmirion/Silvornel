'use strict';

class ModerationConsumer {
  constructor({ queueClient }) {
    this.queueClient = queueClient;
  }

  async start() {}
}

module.exports = { ModerationConsumer };
