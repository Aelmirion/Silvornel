'use strict';

function createIdempotencyKey(prefix, id) {
  return `${prefix}:${id}`;
}

module.exports = { createIdempotencyKey };
