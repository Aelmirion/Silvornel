'use strict';

const CACHE_KEYS = {
  userProfile: (id) => `v1:user:${id}:profile`,
  guildSettings: (id) => `v1:guild:${id}:settings`
};

module.exports = { CACHE_KEYS };
