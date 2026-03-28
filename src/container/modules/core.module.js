'use strict';

const { TOKENS } = require('../tokens');
const { createEnvConfig } = require('../../config/env');
const { createDiscordConfig } = require('../../config/discord.config');
const { createDbConfig } = require('../../config/db.config');
const { createRedisConfig } = require('../../config/redis.config');
const { Logger } = require('../../core/logger/logger');
const { ErrorMapper } = require('../../core/errors/ErrorMapper');
const { LifecycleBootstrap } = require('../../bootstrap/lifecycle.bootstrap');

function registerCoreModule(container) {
  container.bind(TOKENS.EnvConfig, () => createEnvConfig(process.env));
  container.bind(TOKENS.DiscordConfig, (c) => createDiscordConfig(c.resolve(TOKENS.EnvConfig)));
  container.bind(TOKENS.DbConfig, (c) => createDbConfig(c.resolve(TOKENS.EnvConfig)));
  container.bind(TOKENS.RedisConfig, (c) => createRedisConfig(c.resolve(TOKENS.EnvConfig)));
  container.bind(TOKENS.Logger, () => new Logger());
  container.bind(TOKENS.ErrorMapper, () => new ErrorMapper());
  container.bind(TOKENS.LifecycleBootstrap, (c) => new LifecycleBootstrap({ logger: c.resolve(TOKENS.Logger) }));
}

module.exports = { registerCoreModule };
