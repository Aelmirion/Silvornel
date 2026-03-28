'use strict';

function createErrorMiddleware({ errorMapper }) {
  return async function errorMiddleware(ctx, next) {
    try {
      return await next(ctx);
    } catch (error) {
      throw errorMapper.map(error);
    }
  };
}

module.exports = { createErrorMiddleware };
