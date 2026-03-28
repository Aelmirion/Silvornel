'use strict';

const { createClient } = require('redis');

function createRedisClient(config) {
  return createClient({ url: config.url });
}

module.exports = { createRedisClient };
