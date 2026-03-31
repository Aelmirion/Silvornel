'use strict';

const mariadb = require('mariadb');
const { createClient } = require('redis');
const { randomUUID } = require('crypto');

const { CircuitBreaker } = require('../../src/core/utils/circuitBreaker');
const { QueueClient } = require('../../src/adapters/redis/queue.client');
const { QueueService } = require('../../src/application/services/queue.service');
const { WarningRepository } = require('../../src/infrastructure/repositories/warning.repository');
const { moderationSql } = require('../../src/adapters/db/sql/moderation.sql');
const { ModerationService } = require('../../src/application/services/command/moderation.service');
const { TransactionManager } = require('../../src/adapters/db/tx.manager');
const { RetryConsumer } = require('../../src/infrastructure/queue/consumers/retry.consumer');
const { ModerationConsumer } = require('../../src/infrastructure/queue/consumers/moderation.consumer');
const { PubClient } = require('../../src/adapters/redis/pub.client');
const { SubClient } = require('../../src/adapters/redis/sub.client');
const { CacheClient } = require('../../src/adapters/redis/cache.client');
const { Publisher } = require('../../src/infrastructure/pubsub/publisher');
const { PubSubService } = require('../../src/application/services/pubsub.service');
const { L1CacheRepository } = require('../../src/infrastructure/cache/l1.cache.repository');
const { CacheService } = require('../../src/application/services/cache.service');
const { WarningCacheRepository } = require('../../src/infrastructure/cache/warning.cache.repository');
const { CacheInvalidationSubscriber } = require('../../src/infrastructure/pubsub/subscribers/cacheInvalidation.subscriber');
const { QUEUE_NAMES } = require('../../src/config/constants/queue.names');

function createEnvConfigForTests() {
  return {
    db: {
      host: process.env.TEST_MARIADB_HOST || '127.0.0.1',
      port: Number(process.env.TEST_MARIADB_PORT || 3306),
      user: process.env.TEST_MARIADB_USER || 'root',
      password: process.env.TEST_MARIADB_PASSWORD || '',
      database: process.env.TEST_MARIADB_DATABASE || 'silvornel_test',
      connectionLimit: Number(process.env.TEST_MARIADB_CONNECTION_LIMIT || 8),
      connectTimeout: Number(process.env.TEST_MARIADB_CONNECT_TIMEOUT_MS || 5000),
      acquireTimeout: Number(process.env.TEST_MARIADB_ACQUIRE_TIMEOUT_MS || 5000)
    },
    redis: {
      url: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379'
    },
    queue: {
      retryBaseMs: Number(process.env.TEST_QUEUE_RETRY_BASE_MS || 50),
      maxAttempts: Number(process.env.TEST_QUEUE_MAX_ATTEMPTS || 3),
      maxLength: Number(process.env.TEST_QUEUE_MAX_LENGTH || 1000)
    },
    runtime: {
      externalCallTimeoutMs: Number(process.env.TEST_EXTERNAL_CALL_TIMEOUT_MS || 200)
    }
  };
}

async function ensureTables(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS warnings (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        moderator_id VARCHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        created_at VARCHAR(40) NOT NULL
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS warning_counts (
        guild_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        warnings INT NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      )
    `);
    await conn.query(moderationSql.ensureModerationActionsTable);
    await conn.query(moderationSql.ensureEventOutboxTable);
    await conn.query(moderationSql.ensureModerationEffectExecutionsTable);
  } finally {
    conn.release();
  }
}

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

async function createSystemContext(options = {}) {
  const envConfig = createEnvConfigForTests();
  const pool = mariadb.createPool(envConfig.db);
  await ensureTables(pool);

  const redisQueue = createClient({ url: envConfig.redis.url });
  const redisPub = createClient({ url: envConfig.redis.url });
  const redisSub = createClient({ url: envConfig.redis.url });
  const redisCache = createClient({ url: envConfig.redis.url });
  await Promise.all([redisQueue.connect(), redisPub.connect(), redisSub.connect(), redisCache.connect()]);

  const logger = createLogger();
  const breaker = new CircuitBreaker('system-tests', { timeoutMs: 5000 });
  const queueClient = new QueueClient({ redisClient: redisQueue, circuitBreaker: breaker });
  const queueService = new QueueService({ queueClient, envConfig, logger });

  const warningRepository = new WarningRepository({ pool, moderationSql });
  const transactionManager = new TransactionManager({ pool });

  const l1Cache = new L1CacheRepository();
  const cacheClient = new CacheClient({ redisClient: redisCache, circuitBreaker: breaker });
  const cacheService = new CacheService({ l1Cache, cacheClient });
  const warningCacheRepository = new WarningCacheRepository({ cacheService });

  const pubClient = new PubClient({ redisClient: redisPub, circuitBreaker: breaker });
  const publisher = new Publisher({ pubClient });
  const pubSubService = options.pubSubServiceOverride || new PubSubService({ publisher, subscriber: null });

  const subscriber = new CacheInvalidationSubscriber({
    subClient: new SubClient({ redisClient: redisSub, circuitBreaker: breaker }),
    l1Cache
  });

  const moderationService = new ModerationService({
    warningRepository,
    warningCacheRepository,
    pubSubService,
    queueService,
    logger,
    transactionManager
  });

  return {
    envConfig,
    logger,
    pool,
    redis: { redisQueue, redisPub, redisSub, redisCache },
    queueClient,
    queueService,
    warningRepository,
    moderationService,
    warningCacheRepository,
    l1Cache,
    subscriber,
    pubSubService
  };
}

async function resetTestState(ctx) {
  const conn = await ctx.pool.getConnection();
  try {
    await conn.query('DELETE FROM warnings');
    await conn.query('DELETE FROM warning_counts');
    await conn.query('DELETE FROM moderation_actions');
    await conn.query('DELETE FROM event_outbox');
    await conn.query('DELETE FROM moderation_effect_executions');
  } finally {
    conn.release();
  }

  const keys = await ctx.redis.redisQueue.keys('v1:*');
  if (keys.length > 0) {
    await ctx.redis.redisQueue.del(keys);
  }
  await ctx.redis.redisQueue.del('delayed_jobs');
}

function createModerationConsumer(ctx, moderationActionService) {
  return new ModerationConsumer({
    queueClient: ctx.queueClient,
    envConfig: ctx.envConfig,
    moderationActionService,
    warningRepository: ctx.warningRepository,
    logger: ctx.logger
  });
}

function createRetryConsumer(ctx, pubSubService = ctx.pubSubService) {
  return new RetryConsumer({
    queueClient: ctx.queueClient,
    warningRepository: ctx.warningRepository,
    pubSubService,
    logger: ctx.logger
  });
}

function startWorkers({ moderationConsumer, retryConsumer }) {
  const tasks = [];
  if (moderationConsumer) {
    tasks.push(Promise.resolve().then(() => moderationConsumer.start()));
  }
  if (retryConsumer) {
    tasks.push(Promise.resolve().then(() => retryConsumer.start()));
  }
  return tasks;
}

async function stopWorkers({ moderationConsumer, retryConsumer, tasks }) {
  if (moderationConsumer) moderationConsumer.isRunning = false;
  if (retryConsumer) retryConsumer.isRunning = false;
  await Promise.race([
    Promise.allSettled(tasks || []),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
}

async function simulateCrash({ moderationConsumer, retryConsumer }) {
  if (moderationConsumer) moderationConsumer.isRunning = false;
  if (retryConsumer) retryConsumer.isRunning = false;
}

async function shutdownContext(ctx) {
  await Promise.all([
    ctx.redis.redisQueue.quit(),
    ctx.redis.redisPub.quit(),
    ctx.redis.redisSub.quit(),
    ctx.redis.redisCache.quit()
  ]);
  await ctx.pool.end();
}

async function waitFor(assertion, timeoutMs = 5000, stepMs = 50) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
  }
  throw lastError || new Error('waitFor timeout');
}

function createWarnDto(overrides = {}) {
  return {
    action: 'warn',
    guildId: overrides.guildId || 'guild-1',
    moderatorId: overrides.moderatorId || 'mod-1',
    targetUserId: overrides.targetUserId || 'user-1',
    reason: overrides.reason || 'test reason',
    correlationId: overrides.correlationId || randomUUID(),
    causationId: overrides.causationId || randomUUID(),
    moderationActionId: overrides.moderationActionId || randomUUID(),
    traceId: overrides.traceId || randomUUID()
  };
}

module.exports = {
  QUEUE_NAMES,
  createSystemContext,
  resetTestState,
  createModerationConsumer,
  createRetryConsumer,
  startWorkers,
  stopWorkers,
  simulateCrash,
  shutdownContext,
  waitFor,
  createWarnDto
};
