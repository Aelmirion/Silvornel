'use strict';

class ControllerRegistry {
  constructor({ pingController, profileController, moderationController }) {
    this.pingController = pingController;
    this.profileController = profileController;
    this.moderationController = moderationController;
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
