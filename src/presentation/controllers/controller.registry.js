'use strict';

class ControllerRegistry {
  constructor({ pingController, profileController, moderationController }) {
    this.pingController = pingController;
    this.profileController = profileController;
    this.moderationController = moderationController;
  }

  validateCompleteness() {
    if (!this.pingController || !this.profileController || !this.moderationController) {
      throw new Error('Controller registry is incomplete');
    }
  }

  resolve(context) {
    const commandName = context?.commandName;
    if (commandName === 'ping') return this.pingController;
    if (commandName === 'profile') return this.profileController;
    if (commandName === 'moderation') return this.moderationController;
    return this.pingController;
  }
}

module.exports = { ControllerRegistry };
