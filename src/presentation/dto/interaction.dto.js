'use strict';

class InteractionDto {
  constructor({ id, type, userId, guildId, payload }) {
    this.id = id;
    this.type = type;
    this.userId = userId;
    this.guildId = guildId;
    this.payload = payload;
  }
}

module.exports = { InteractionDto };
