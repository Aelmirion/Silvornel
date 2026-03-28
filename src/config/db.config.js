'use strict';

function createDbConfig(envConfig) {
  return { ...envConfig.db };
}

module.exports = { createDbConfig };
