'use strict';

class ModerationController {
  constructor({ moderationService }) {
    this.moderationService = moderationService;
  }

  async execute(interactionDto) {
    return this.moderationService.execute(interactionDto);
  }
}

module.exports = { ModerationController };
