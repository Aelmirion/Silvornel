'use strict';

const { randomUUID } = require('crypto');

async function tracingMiddleware(ctx, next) {
  const correlationId = ctx?.correlationId || ctx?.id || randomUUID();
  const causationId = ctx?.causationId || correlationId;
  return next({
    ...ctx,
    correlationId,
    causationId
  });
}

module.exports = { tracingMiddleware };
