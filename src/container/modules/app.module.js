'use strict';

const { TOKENS } = require('../tokens');
const { CacheService } = require('../../application/services/cache.service');
const { QueueService } = require('../../application/services/queue.service');
const { RateLimitService } = require('../../application/services/rateLimit.service');
const { PubSubService } = require('../../application/services/pubsub.service');
const { PingService } = require('../../application/services/command/ping.service');
const { ProfileService } = require('../../application/services/command/profile.service');
const { ModerationService } = require('../../application/services/command/moderation.service');
const { InteractionOrchestrator } = require('../../application/orchestrators/interaction.orchestrator');

function registerAppModule(container) {
  container.bind(TOKENS.CacheService, (c) => new CacheService({ l1Cache: c.resolve(TOKENS.L1Cache), cacheClient: c.resolve(TOKENS.CacheClient) }));
  container.bind(TOKENS.QueueService, (c) => new QueueService({ queueClient: c.resolve(TOKENS.QueueClient) }));
  container.bind(TOKENS.RateLimitService, (c) => new RateLimitService({ rateLimitClient: c.resolve(TOKENS.RateLimitClient) }));
  container.bind(TOKENS.PubSubService, (c) => new PubSubService({ publisher: c.resolve('Publisher'), subscriber: c.resolve(TOKENS.SubClient) }));
  container.bind(TOKENS.PingService, () => new PingService());
  container.bind(TOKENS.ProfileService, (c) => new ProfileService({ userRepository: c.resolve(TOKENS.UserRepository), userCacheRepository: c.resolve(TOKENS.UserCacheRepository) }));
  container.bind(TOKENS.ModerationService, (c) => new ModerationService({ warningRepository: c.resolve(TOKENS.WarningRepository) }));
  container.bind(TOKENS.InteractionOrchestrator, (c) => new InteractionOrchestrator({
    middlewarePipeline: c.resolve(TOKENS.MiddlewarePipeline),
    controllerRegistry: c.resolve(TOKENS.ControllerRegistry)
  }));
}

module.exports = { registerAppModule };
