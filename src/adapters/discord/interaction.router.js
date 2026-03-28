'use strict';

class InteractionRouter {
  constructor({ interactionOrchestrator, interactionMapper, interactionResponder }) {
    this.interactionOrchestrator = interactionOrchestrator;
    this.interactionMapper = interactionMapper;
    this.interactionResponder = interactionResponder;
  }

  async route(interaction) {
    if (!interaction.isChatInputCommand()) {
      return null;
    }

    const interactionDto = this.interactionMapper.toDto(interaction);
    const serviceResponse = await this.interactionOrchestrator.handle(interactionDto);
    return this.interactionResponder.reply(interaction, serviceResponse);
  }
}

module.exports = { InteractionRouter };
