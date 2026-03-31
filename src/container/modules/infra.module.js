'use strict';

const { TOKENS } = require('../tokens');
const { guildSql } = require('../../adapters/db/sql/guild.sql');
const { userSql } = require('../../adapters/db/sql/user.sql');
const { moderationSql } = require('../../adapters/db/sql/moderation.sql');
const { GuildRepository } = require('../../infrastructure/repositories/guild.repository');
const { UserRepository } = require('../../infrastructure/repositories/user.repository');
const { WarningRepository } = require('../../infrastructure/repositories/warning.repository');
const { L1CacheRepository } = require('../../infrastructure/cache/l1.cache.repository');
const { UserCacheRepository } = require('../../infrastructure/cache/user.cache.repository');
const { WarningCacheRepository } = require('../../infrastructure/cache/warning.cache.repository');
const { Publisher } = require('../../infrastructure/pubsub/publisher');
const { CacheInvalidationSubscriber } = require('../../infrastructure/pubsub/subscribers/cacheInvalidation.subscriber');
const { ModerationConsumer } = require('../../infrastructure/queue/consumers/moderation.consumer');
const { RetryConsumer } = require('../../infrastructure/queue/consumers/retry.consumer');
const { DeadLetterWorker } = require('../../workers/deadletter.worker');

function registerInfraModule(container) {
  container.bind(TOKENS.GuildRepository, (c) => new GuildRepository({ pool: c.resolve(TOKENS.DbPool), guildSql }));
  container.bind(TOKENS.UserRepository, (c) => new UserRepository({ pool: c.resolve(TOKENS.DbPool), userSql }));
  container.bind(TOKENS.WarningRepository, (c) => new WarningRepository({ pool: c.resolve(TOKENS.DbPool), moderationSql }));
  container.bind(TOKENS.L1Cache, () => new L1CacheRepository());
  container.bind(TOKENS.UserCacheRepository, (c) => new UserCacheRepository({ cacheService: c.resolve(TOKENS.CacheService) }));
  container.bind(TOKENS.WarningCacheRepository, (c) => new WarningCacheRepository({ cacheService: c.resolve(TOKENS.CacheService) }));

  container.bind(TOKENS.Publisher, (c) => new Publisher({ pubClient: c.resolve(TOKENS.PubClient) }));
  container.bind(TOKENS.CacheInvalidationSubscriber, (c) => new CacheInvalidationSubscriber({
    subClient: c.resolve(TOKENS.SubClient),
    l1Cache: c.resolve(TOKENS.L1Cache)
  }));
  container.bind(TOKENS.ModerationConsumer, (c) => new ModerationConsumer({
    queueClient: c.resolve(TOKENS.QueueClient),
    envConfig: c.resolve(TOKENS.EnvConfig),
    warningRepository: c.resolve(TOKENS.WarningRepository),
    logger: c.resolve(TOKENS.Logger)
  }));
  container.bind(TOKENS.RetryConsumer, (c) => new RetryConsumer({
    queueClient: c.resolve(TOKENS.QueueClient),
    warningRepository: c.resolve(TOKENS.WarningRepository),
    pubSubService: c.resolve(TOKENS.PubSubService),
    logger: c.resolve(TOKENS.Logger)
  }));
  container.bind(TOKENS.DeadLetterWorker, () => new DeadLetterWorker());
}

module.exports = { registerInfraModule };
