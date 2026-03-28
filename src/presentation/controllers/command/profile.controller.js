'use strict';

const { CommandDto } = require('../../dto/command.dto');

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

    return this.profileService.execute(commandDto);
  }
}

module.exports = { ProfileController };
