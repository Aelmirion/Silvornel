'use strict';

class ModerationService {
  constructor({ warningRepository }) {
    this.warningRepository = warningRepository;
  }

  async execute(_interactionDto) {
    return null;
  }
}

module.exports = { ModerationService };
