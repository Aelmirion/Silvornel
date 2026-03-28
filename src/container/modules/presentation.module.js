'use strict';

const { TOKENS } = require('../tokens');
const { PingController } = require('../../presentation/controllers/command/ping.controller');
const { ProfileController } = require('../../presentation/controllers/command/profile.controller');
const { ModerationController } = require('../../presentation/controllers/command/moderation.controller');

function registerPresentationModule(container) {
  container.bind(TOKENS.PingController, (c) => new PingController({ pingService: c.resolve(TOKENS.PingService) }));
  container.bind(TOKENS.ProfileController, (c) => new ProfileController({ profileService: c.resolve(TOKENS.ProfileService) }));
  container.bind(TOKENS.ModerationController, (c) => new ModerationController({ moderationService: c.resolve(TOKENS.ModerationService) }));
}

module.exports = { registerPresentationModule };
