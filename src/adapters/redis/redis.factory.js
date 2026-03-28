'use strict';

const { createClient } = require('redis');
const { computeBackoffMs } = require('../../core/utils/backoff');

function createRedisClient(config) {
  return createClient({
    url: config.url,
    socket: {
      reconnectStrategy(retries) {
        if (retries >= config.maxRetryAttempts) {
          return new Error('Redis max retry attempts reached');
        }
        return computeBackoffMs(retries + 1, config.retryBaseMs);
      }
    }
  });
}

module.exports = { createRedisClient };
