'use strict';

function serializeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  };
}

module.exports = { serializeError };
