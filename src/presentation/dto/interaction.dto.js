'use strict';

class InteractionDto {
  constructor({ id, type, commandName, userId, guildId, options, memberPermissions = [], memberRoles = [], isGuildOwner = false, payload, correlationId = null, causationId = null }) {
    this.id = id;
    this.type = type;
    this.commandName = commandName;
    this.userId = userId;
    this.guildId = guildId;
    this.options = options;
    this.memberPermissions = memberPermissions;
    this.memberRoles = memberRoles;
    this.isGuildOwner = isGuildOwner;
    this.payload = payload;
    this.correlationId = correlationId;
    this.causationId = causationId;
  }
}

module.exports = { InteractionDto };
