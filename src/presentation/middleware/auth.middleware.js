'use strict';

async function authMiddleware(ctx, next) {
  return next(ctx);
}

module.exports = { authMiddleware };
