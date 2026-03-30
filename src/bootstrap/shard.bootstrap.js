'use strict';

const { TOKENS } = require('../container/tokens');
const { LifecycleState } = require('./lifecycle.bootstrap');

function startBackgroundWorker({ worker, workerName, logger }) {
  Promise.resolve()
    .then(() => worker.start())
    .catch((error) => {
      if (logger?.error) {
        logger.error(`Background worker crashed: ${workerName}`, { error: error.message, workerName });
        return;
      }

      // eslint-disable-next-line no-console
      console.error(`[bootstrap] background worker crashed: ${workerName}`, error);
    });
}

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

  const logger = container.resolve(TOKENS.Logger);
  const queueWorkers = [
    { token: TOKENS.ModerationConsumer, name: 'moderation.consumer' },
    { token: TOKENS.RetryConsumer, name: 'retry.consumer' },
    { token: TOKENS.DeadLetterWorker, name: 'deadletter.worker' }
  ];

  for (const queueWorker of queueWorkers) {
    const worker = container.resolve(queueWorker.token);
    startBackgroundWorker({ worker, workerName: queueWorker.name, logger });
  }

  const discordClient = container.resolve(TOKENS.DiscordClient);
  const eventRouter = container.resolve(TOKENS.EventRouter);
  const envConfig = container.resolve(TOKENS.EnvConfig);

  eventRouter.register(discordClient);
  await discordClient.login(envConfig.discord.token);

  lifecycle.setState(LifecycleState.READY);
}

module.exports = { bootstrapShard };
