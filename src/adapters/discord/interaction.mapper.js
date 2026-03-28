'use strict';

const { InteractionDto } = require('../../presentation/dto/interaction.dto');

class InteractionMapper {
  toDto(interaction) {
    return new InteractionDto({
      id: interaction.id,
      type: interaction.type,
      commandName: interaction.commandName,
      userId: interaction.user?.id || null,
      guildId: interaction.guildId || null,
      options: interaction.options?.data || [],
      payload: null
    });
  }
}

module.exports = { InteractionMapper };
