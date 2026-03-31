'use strict';

class CommandDto {
  constructor({ commandName, userId, guildId, options, correlationId = null }) {
    this.commandName = commandName;
    this.userId = userId;
    this.guildId = guildId;
    this.options = options;
    this.correlationId = correlationId;
  }
}

module.exports = { CommandDto };
