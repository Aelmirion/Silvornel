'use strict';

const { TOKENS } = require('../container/tokens');
const { LifecycleState } = require('./lifecycle.bootstrap');

async function bootstrapShard({ container }) {
  const lifecycle = container.resolve(TOKENS.LifecycleBootstrap);
  lifecycle.setState(LifecycleState.CONNECTING);

  const discordClient = container.resolve(TOKENS.DiscordClient);
  const eventRouter = container.resolve(TOKENS.EventRouter);
  const envConfig = container.resolve(TOKENS.EnvConfig);

  eventRouter.register(discordClient);
  await discordClient.login(envConfig.discord.token);

  lifecycle.setState(LifecycleState.READY);
}

module.exports = { bootstrapShard };
