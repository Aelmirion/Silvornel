'use strict';

class InteractionDto {
  constructor({ id, type, commandName, userId, guildId, options, memberPermissions = [], memberRoles = [], isGuildOwner = false, payload }) {
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
  }
}

module.exports = { InteractionDto };
