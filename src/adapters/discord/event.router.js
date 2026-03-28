'use strict';

class EventRouter {
  constructor({ lifecycleBootstrap }) {
    this.lifecycleBootstrap = lifecycleBootstrap;
  }

  register(_client) {}
}

module.exports = { EventRouter };
