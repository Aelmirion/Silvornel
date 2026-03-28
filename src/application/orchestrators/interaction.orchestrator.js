'use strict';

class InteractionOrchestrator {
  constructor({ pingController, profileController, moderationController }) {
    this.pingController = pingController;
    this.profileController = profileController;
    this.moderationController = moderationController;
  }

  async handle(_interaction) {
    return null;
  }
}

module.exports = { InteractionOrchestrator };
