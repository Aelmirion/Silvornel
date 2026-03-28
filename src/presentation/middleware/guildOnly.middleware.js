'use strict';

async function guildOnlyMiddleware(ctx, next) {
  return next(ctx);
}

module.exports = { guildOnlyMiddleware };
