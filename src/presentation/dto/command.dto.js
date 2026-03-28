'use strict';

class CommandDto {
  constructor({ commandName, userId, guildId, options }) {
    this.commandName = commandName;
    this.userId = userId;
    this.guildId = guildId;
    this.options = options;
  }
}

module.exports = { CommandDto };
