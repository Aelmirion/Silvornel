'use strict';

const { withTimeout } = require('../../../core/utils/timeout');

const EXTERNAL_TIMEOUT_MS = 2_000;

class InteractionResponder {
  format(serviceResponse) {
    if (!serviceResponse || serviceResponse.kind !== 'interaction.response') {
      return { content: 'Unsupported response payload.' };
    }

    return {
      content: serviceResponse.data?.content || ''
    };
  }

  async reply(interaction, serviceResponse) {
    const payload = this.format(serviceResponse);

    if (interaction.deferred || interaction.replied) {
      return withTimeout(() => interaction.followUp(payload), EXTERNAL_TIMEOUT_MS, 'discord.followUp');
    }

    return withTimeout(() => interaction.reply(payload), EXTERNAL_TIMEOUT_MS, 'discord.reply');
  }
}

module.exports = { InteractionResponder };
