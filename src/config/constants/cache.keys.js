'use strict';

const CACHE_KEYS = {
  userProfile: (id) => `v1:user:${id}:profile`,
  guildSettings: (id) => `v1:guild:${id}:settings`,
  warningsByUser: (guildId, userId) => `v1:guild:${guildId}:user:${userId}:warnings`,
  recentWriteBypass: (key) => `v1:cache:bypass:${key}`
};

module.exports = { CACHE_KEYS };
