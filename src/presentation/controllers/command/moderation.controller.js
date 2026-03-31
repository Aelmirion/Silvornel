'use strict';

const { CommandDto } = require('../../dto/command.dto');
const { ModerationDto } = require('../../dto/moderation.dto');

class ModerationController {
  constructor({ moderationService }) {
    this.moderationService = moderationService;
  }

  async execute(interactionDto) {
    const commandDto = new CommandDto({
      commandName: interactionDto.commandName,
      userId: interactionDto.userId,
      guildId: interactionDto.guildId,
      options: interactionDto.options,
      correlationId: interactionDto.correlationId || interactionDto.id || null,
      causationId: interactionDto.causationId || interactionDto.id || null,
      moderationActionId: interactionDto.id || null
    });

    const moderationDto = ModerationDto.fromCommand(commandDto);

    if (moderationDto.action === 'warn') {
      return this.moderationService.warnUser(moderationDto);
    }

    if (moderationDto.action === 'warnings') {
      return this.moderationService.getWarnings(moderationDto);
    }

    return this.moderationService.clearWarnings(moderationDto);
  }
}

module.exports = { ModerationController };
