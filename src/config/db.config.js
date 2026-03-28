'use strict';

function createDbConfig(envConfig) {
  return {
    ...envConfig.db,
    connectTimeout: envConfig.db.connectTimeoutMs,
    acquireTimeout: envConfig.db.acquireTimeoutMs
  };
}

module.exports = { createDbConfig };
