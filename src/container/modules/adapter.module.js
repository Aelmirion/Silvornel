'use strict';

const { TOKENS } = require('../tokens');
const { createDiscordClient } = require('../../adapters/discord/discord.client');
const { EventRouter } = require('../../adapters/discord/event.router');
const { InteractionRouter } = require('../../adapters/discord/interaction.router');
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
  container.bind(TOKENS.CircuitBreakerRedis, () => new CircuitBreaker('redis'));
  container.bind(TOKENS.CircuitBreakerDb, () => new CircuitBreaker('db'));
  container.bind(TOKENS.DiscordClient, (c) => createDiscordClient(c.resolve(TOKENS.DiscordConfig)));
  container.bind(TOKENS.EventRouter, (c) => new EventRouter({ lifecycleBootstrap: c.resolve(TOKENS.LifecycleBootstrap) }));
  container.bind(TOKENS.InteractionRouter, (c) => new InteractionRouter({ interactionOrchestrator: c.resolve(TOKENS.InteractionOrchestrator) }));
  container.bind(TOKENS.DbPool, (c) => createMariaDbPool(c.resolve(TOKENS.DbConfig)));
  container.bind(TOKENS.TransactionManager, (c) => new TransactionManager({ pool: c.resolve(TOKENS.DbPool) }));

  container.bind('RedisBaseClient', (c) => createRedisClient(c.resolve(TOKENS.RedisConfig)));
  container.bind(TOKENS.CacheClient, (c) => new CacheClient({ redisClient: c.resolve('RedisBaseClient'), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.PubClient, (c) => new PubClient({ redisClient: c.resolve('RedisBaseClient'), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.SubClient, (c) => new SubClient({ redisClient: c.resolve('RedisBaseClient'), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.RateLimitClient, (c) => new RateLimitClient({ redisClient: c.resolve('RedisBaseClient'), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
  container.bind(TOKENS.QueueClient, (c) => new QueueClient({ redisClient: c.resolve('RedisBaseClient'), circuitBreaker: c.resolve(TOKENS.CircuitBreakerRedis) }));
}

module.exports = { registerAdapterModule };
