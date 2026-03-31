'use strict';

const { TOKENS } = require('../tokens');
const { PingController } = require('../../presentation/controllers/command/ping.controller');
const { ProfileController } = require('../../presentation/controllers/command/profile.controller');
const { ModerationController } = require('../../presentation/controllers/command/moderation.controller');
const { ControllerRegistry } = require('../../presentation/controllers/controller.registry');
const { MiddlewarePipeline } = require('../../presentation/middleware/pipeline');
const { authMiddleware } = require('../../presentation/middleware/auth.middleware');
const { guildOnlyMiddleware } = require('../../presentation/middleware/guildOnly.middleware');
const { createRateLimitMiddleware } = require('../../presentation/middleware/rateLimit.middleware');
const { cooldownMiddleware } = require('../../presentation/middleware/cooldown.middleware');
const { validationMiddleware } = require('../../presentation/middleware/validation.middleware');
const { createErrorMiddleware } = require('../../presentation/middleware/error.middleware');
const { tracingMiddleware } = require('../../presentation/middleware/tracing.middleware');

function registerPresentationModule(container) {
  container.bind(TOKENS.PingController, (c) => new PingController({ pingService: c.resolve(TOKENS.PingService) }));
  container.bind(TOKENS.ProfileController, (c) => new ProfileController({ profileService: c.resolve(TOKENS.ProfileService) }));
  container.bind(TOKENS.ModerationController, (c) => new ModerationController({ moderationService: c.resolve(TOKENS.ModerationService) }));

  container.bind(TOKENS.ControllerRegistry, (c) => new ControllerRegistry({
    pingController: c.resolve(TOKENS.PingController),
    profileController: c.resolve(TOKENS.ProfileController),
    moderationController: c.resolve(TOKENS.ModerationController)
  }));

  container.bind(TOKENS.MiddlewarePipeline, (c) => new MiddlewarePipeline({
    logger: c.resolve(TOKENS.Logger),
    metrics: c.resolve(TOKENS.Metrics),
    middlewares: [
      createErrorMiddleware({ errorMapper: c.resolve(TOKENS.ErrorMapper) }),
      tracingMiddleware,
      authMiddleware,
      guildOnlyMiddleware,
      createRateLimitMiddleware({ rateLimitService: c.resolve(TOKENS.RateLimitService) }),
      cooldownMiddleware,
      validationMiddleware
    ]
  }));
}

module.exports = { registerPresentationModule };
