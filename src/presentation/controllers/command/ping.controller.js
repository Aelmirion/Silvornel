'use strict';

const { CommandDto } = require('../../dto/command.dto');

class PingController {
  constructor({ pingService }) {
    this.pingService = pingService;
  }

  async execute(interactionDto) {
    const commandDto = new CommandDto({
      commandName: interactionDto.commandName,
      userId: interactionDto.userId,
      guildId: interactionDto.guildId,
      options: interactionDto.options
    });

    return this.pingService.execute(commandDto);
  }
}

module.exports = { PingController };
