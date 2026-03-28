'use strict';

const { LifecycleState } = require('./lifecycle.bootstrap');

async function bootstrapShard({ container }) {
  const lifecycle = container.resolve('LifecycleBootstrap');
  lifecycle.setState(LifecycleState.CONNECTING);

  const discordClient = container.resolve('DiscordClient');
  const eventRouter = container.resolve('EventRouter');
  eventRouter.register(discordClient);

  lifecycle.setState(LifecycleState.READY);
}

module.exports = { bootstrapShard };
