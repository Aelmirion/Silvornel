'use strict';

class CommandDto {
  constructor({ commandName, userId, guildId, options, correlationId = null, causationId = null, moderationActionId = null }) {
    this.commandName = commandName;
    this.userId = userId;
    this.guildId = guildId;
    this.options = options;
    this.correlationId = correlationId;
    this.causationId = causationId;
    this.moderationActionId = moderationActionId;
  }
}

module.exports = { CommandDto };
