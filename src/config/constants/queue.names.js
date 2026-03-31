'use strict';

const redisKeyPrefix = process.env.REDIS_KEY_PREFIX || '';

const QUEUE_NAMES = {
  moderation: `${redisKeyPrefix}v1:queue:moderation`,
  analytics: `${redisKeyPrefix}v1:queue:analytics`
};

module.exports = { QUEUE_NAMES };
