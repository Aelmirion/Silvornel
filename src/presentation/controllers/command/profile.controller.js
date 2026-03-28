'use strict';

class ProfileController {
  constructor({ profileService }) {
    this.profileService = profileService;
  }

  async execute(interactionDto) {
    return this.profileService.execute(interactionDto);
  }
}

module.exports = { ProfileController };
