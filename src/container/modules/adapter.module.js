'use strict';

const { TOKENS } = require('../tokens');
const { createDiscordClient } = require('../../adapters/discord/discord.client');
const { EventRouter } = require('../../adapters/discord/event.router');
const { InteractionRouter } = require('../../adapters/discord/interaction.router');
const { InteractionMapper } = require('../../adapters/discord/interaction.mapper');
const { InteractionResponder } = require('../../adapters/discord/responders/interaction.responder');
const { createMariaDbPool } = require('../../adapters/db/mariadb.pool');
const { TransactionManager } = require('../../adapters/db/tx.manager');
const { createRedisClient } = require('../../adapters/redis/redis.factory');
const { CacheClient } = require('../../adapters/redis/cache.client');
const { PubClient } = require('../../adapters/redis/pub.client');
const { SubClient } = require('../../adapters/redis/sub.client');
const { RateLimitClient } = require('../../adapters/redis/rateLimit.client');
const { QueueClient } = require('../../adapters/redis/queue.client');
const { CircuitBreaker } = require('../../core/utils/circuitBreaker');

function registerAdapterModule(container) {
  container.bind(TOKENS.CircuitBreakerRedis, (c) => new CircuitBreaker('redis', { timeoutMs: c.resolve(TOKENS.EnvConfig).runtime.externalCallTimeoutMs }));
  container.bind(TOKENS.CircuitBreakerDb, (c) => new CircuitBreaker('db', { timeoutMs: c.resolve(TOKENS.EnvConfig).runtime.externalCallTimeoutMs }));

  container.bind(TOKENS.DiscordClient, (c) => createDiscordClient(c.resolve(TOKENS.DiscordConfig)));
  container.bind(TOKENS.InteractionMapper, () => new InteractionMapper());
  container.bind(TOKENS.InteractionResponder, () => new InteractionResponder());
  container.bind(TOKENS.InteractionRouter, (c) => new InteractionRouter({
    interactionOrchestrator: c.resolve(TOKENS.InteractionOrchestrator),
    interactionMapper: c.resolve(TOKENS.InteractionMapper),
    interactionResponder: c.resolve(TOKENS.InteractionResponder)
  }));
  container.bind(TOKENS.EventRouter, (c) => new EventRouter({
    lifecycleBootstrap: c.resolve(TOKENS.LifecycleBootstrap),
    interactionRouter: c.resolve(TOKENS.InteractionRouter),
    logger: c.resolve(TOKENS.Logger)
  }));

  container.bind(TOKENS.DbPool, (c) => createMariaDbPool(c.resolve(TOKENS.DbConfig)));
  container.bind(TOKENS.TransactionManager, (c) => new TransactionManager({ pool: c.resolve(TOKENS.DbPool) }));

  // Strict Redis client separation by function.
  container.bind(TOKENS.RedisCacheBaseClient, (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));
  container.bind(TOKENS.RedisPubBaseClient, (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));
  container.bind(TOKENS.RedisSubBaseClient, (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));
  container.bind(TOKENS.RedisQueueBaseClient, (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));
  container.bind(TOKENS.RedisRateLimitBaseClient, (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));

  container.bind(TOKENS.CacheClient, (c) => new CacheClient({ redisClient: c.resolve(TOKENS.RedisCacheBaseClient), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.PubClient, (c) => new PubClient({ redisClient: c.resolve(TOKENS.RedisPubBaseClient), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.SubClient, (c) => new SubClient({ redisClient: c.resolve(TOKENS.RedisSubBaseClient), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.QueueClient, (c) => new QueueClient({ redisClient: c.resolve(TOKENS.RedisQueueBaseClient), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.RateLimitClient, (c) => new RateLimitClient({ redisClient: c.resolve(TOKENS.RedisRateLimitBaseClient), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
}

module.exports = { registerAdapterModule };
