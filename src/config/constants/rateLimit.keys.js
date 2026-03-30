'use strict';

const RATE_LIMIT_KEYS = {
  userCommand: (userId, command) => `v1:rl:user:${userId}:cmd:${command}`,
  guildCommand: (guildId, command) => `v1:rl:guild:${guildId}:cmd:${command}`
};

module.exports = { RATE_LIMIT_KEYS };
