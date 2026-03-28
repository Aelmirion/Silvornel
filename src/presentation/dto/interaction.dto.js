'use strict';

class InteractionDto {
  constructor({ id, type, commandName, userId, guildId, options, payload }) {
    this.id = id;
    this.type = type;
    this.commandName = commandName;
    this.userId = userId;
    this.guildId = guildId;
    this.options = options;
    this.payload = payload;
  }
}

module.exports = { InteractionDto };
