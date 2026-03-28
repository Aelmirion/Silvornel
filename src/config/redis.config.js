'use strict';

function createRedisConfig(envConfig) {
  return { ...envConfig.redis };
}

module.exports = { createRedisConfig };
