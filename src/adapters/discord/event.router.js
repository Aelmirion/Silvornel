'use strict';

class EventRouter {
  constructor({ lifecycleBootstrap, interactionRouter, logger }) {
    this.lifecycleBootstrap = lifecycleBootstrap;
    this.interactionRouter = interactionRouter;
    this.logger = logger;
  }

  register(client) {
    client.on('interactionCreate', async (interaction) => {
      await this.interactionRouter.route(interaction);
    });

    client.on('error', (error) => {
      this.logger.error('Discord client error', { error });
    });
  }
}

module.exports = { EventRouter };
