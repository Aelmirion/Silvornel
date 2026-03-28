'use strict';

const { TOKENS } = require('../container/tokens');
const { LifecycleState } = require('./lifecycle.bootstrap');

async function bootstrapShard({ container }) {
  const lifecycle = container.resolve(TOKENS.LifecycleBootstrap);
  lifecycle.setState(LifecycleState.CONNECTING);

  const redisClients = [
    container.resolve(TOKENS.RedisCacheBaseClient),
    container.resolve(TOKENS.RedisPubBaseClient),
    container.resolve(TOKENS.RedisSubBaseClient),
    container.resolve(TOKENS.RedisQueueBaseClient),
    container.resolve(TOKENS.RedisRateLimitBaseClient)
  ];

  await Promise.all(redisClients.map((client) => client.connect()));

  const cacheInvalidationSubscriber = container.resolve(TOKENS.CacheInvalidationSubscriber);
  await cacheInvalidationSubscriber.register();

  const discordClient = container.resolve(TOKENS.DiscordClient);
  const eventRouter = container.resolve(TOKENS.EventRouter);
  const envConfig = container.resolve(TOKENS.EnvConfig);

  eventRouter.register(discordClient);
  await discordClient.login(envConfig.discord.token);

  lifecycle.setState(LifecycleState.READY);
}

module.exports = { bootstrapShard };
