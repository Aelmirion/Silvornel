'use strict';

function createRateLimitMiddleware({ rateLimitService }) {
  return async function rateLimitMiddleware(ctx, next) {
    await rateLimitService.enforce(ctx);
    return next(ctx);
  };
}

module.exports = { createRateLimitMiddleware };
