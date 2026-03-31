'use strict';

const { TOKENS } = require('../container/tokens');
const { LifecycleState } = require('./lifecycle.bootstrap');

function startBackgroundWorker({ worker, workerName, logger, lifecycle }) {
  lifecycle.reportWorkerHealth(workerName, true, 'starting');

  Promise.resolve()
    .then(() => worker.start())
    .catch((error) => {
      lifecycle.reportWorkerHealth(workerName, false, error.message);

      if (logger?.error) {
        logger.error(`Background worker crashed: ${workerName}`, {
          correlationId: 'bootstrap',
          error: error.message,
          workerName
        });
        return;
      }

      // eslint-disable-next-line no-console
      console.error(`[bootstrap] background worker crashed: ${workerName}`, error);
    });
}

async function bootstrapShard({ container }) {
  const lifecycle = container.resolve(TOKENS.LifecycleBootstrap);
  const logger = container.resolve(TOKENS.Logger);
  const metrics = container.resolve(TOKENS.Metrics);

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

  const queueWorkers = [
    { token: TOKENS.ModerationConsumer, name: 'moderation.consumer' },
    { token: TOKENS.RetryConsumer, name: 'retry.consumer' },
    { token: TOKENS.DeadLetterWorker, name: 'deadletter.worker' }
  ];

  for (const queueWorker of queueWorkers) {
    const worker = container.resolve(queueWorker.token);
    startBackgroundWorker({ worker, workerName: queueWorker.name, logger, lifecycle });
  }

  const workersHealthy = lifecycle.areWorkersHealthy();
  if (!workersHealthy) {
    lifecycle.setState(LifecycleState.NOT_READY);
    metrics?.increment?.('lifecycle.ready.blocked.total', { reason: 'worker_health' });
    logger?.warn?.('Shard readiness blocked: unhealthy workers detected before login', {
      correlationId: 'bootstrap'
    });
  }

  const discordClient = container.resolve(TOKENS.DiscordClient);
  const eventRouter = container.resolve(TOKENS.EventRouter);
  const envConfig = container.resolve(TOKENS.EnvConfig);

  eventRouter.register(discordClient);
  await discordClient.login(envConfig.discord.token);

  if (lifecycle.areWorkersHealthy()) {
    lifecycle.setState(LifecycleState.READY);
    metrics?.increment?.('lifecycle.ready.total', { result: 'ready' });
    logger?.info?.('Shard lifecycle entered READY', { correlationId: 'bootstrap' });
    return;
  }

  lifecycle.setState(LifecycleState.NOT_READY);
  metrics?.increment?.('lifecycle.ready.total', { result: 'blocked' });
  logger?.warn?.('Shard lifecycle remained NOT_READY due to worker health', {
    correlationId: 'bootstrap'
  });
}

module.exports = { bootstrapShard };
