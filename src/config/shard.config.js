'use strict';

function createShardConfig(envConfig) {
  return { ...envConfig.sharding };
}

module.exports = { createShardConfig };
