'use strict';

class PingService {
  async execute(commandDto) {
    return {
      kind: 'interaction.response',
      data: {
        content: '🏓 Pong!'
      },
      meta: {
        commandName: commandDto.commandName,
        userId: commandDto.userId
      }
    };
  }
}

module.exports = { PingService };
