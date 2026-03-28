'use strict';

class InteractionRouter {
  constructor({ interactionOrchestrator }) {
    this.interactionOrchestrator = interactionOrchestrator;
  }

  async route(interaction) {
    return this.interactionOrchestrator.handle(interaction);
  }
}

module.exports = { InteractionRouter };
