'use strict';

async function validationMiddleware(ctx, next) {
  return next(ctx);
}

module.exports = { validationMiddleware };
