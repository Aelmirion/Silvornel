'use strict';

async function cooldownMiddleware(ctx, next) {
  return next(ctx);
}

module.exports = { cooldownMiddleware };
