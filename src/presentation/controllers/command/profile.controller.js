'use strict';

const { CommandDto } = require('../../dto/command.dto');
const { ProfileDto } = require('../../dto/profile.dto');

class ProfileController {
  constructor({ profileService }) {
    this.profileService = profileService;
  }

  async execute(interactionDto) {
    const commandDto = new CommandDto({
      commandName: interactionDto.commandName,
      userId: interactionDto.userId,
      guildId: interactionDto.guildId,
      options: interactionDto.options
    });

    const profileDto = ProfileDto.fromCommand(commandDto);

    if (profileDto.action === 'set') {
      return this.profileService.updateProfile(profileDto);
    }

    return this.profileService.getProfile(profileDto);
  }
}

module.exports = { ProfileController };
