'use strict';

async function validationMiddleware(ctx, next) {
  if (!ctx || !ctx.commandName) {
    throw new Error('Invalid interaction context: commandName is required');
  }

  return next(ctx);
}

module.exports = { validationMiddleware };
