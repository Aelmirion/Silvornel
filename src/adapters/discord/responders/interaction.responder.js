'use strict';

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
      return interaction.followUp(payload);
    }

    return interaction.reply(payload);
  }
}

module.exports = { InteractionResponder };
