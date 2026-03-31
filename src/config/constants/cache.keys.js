'use strict';

const redisKeyPrefix = process.env.REDIS_KEY_PREFIX || '';

const CACHE_KEYS = {
  userProfile: (id) => `${redisKeyPrefix}v1:user:${id}:profile`,
  guildSettings: (id) => `${redisKeyPrefix}v1:guild:${id}:settings`,
  warningsByUser: (guildId, userId) => `${redisKeyPrefix}v1:guild:${guildId}:user:${userId}:warnings`,
  recentWriteBypass: (key) => `${redisKeyPrefix}v1:cache:bypass:${key}`
};

module.exports = { CACHE_KEYS };
