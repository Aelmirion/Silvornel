'use strict';

const REDIS_CHANNELS = {
  cacheInvalidate: 'bot:cache:invalidate',
  broadcast: 'v1:bot:broadcast:message',
  controlReload: 'v1:bot:control:reload'
};

module.exports = { REDIS_CHANNELS };
