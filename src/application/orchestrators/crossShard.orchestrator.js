'use strict';

class CrossShardOrchestrator {
  constructor({ pubSubService }) {
    this.pubSubService = pubSubService;
  }

  async broadcast(_event) {}
}

module.exports = { CrossShardOrchestrator };
