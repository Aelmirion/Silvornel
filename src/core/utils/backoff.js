'use strict';

function computeBackoffMs(attempt, baseMs = 100) {
  return Math.min(baseMs * (2 ** Math.max(0, attempt - 1)), 30_000);
}

module.exports = { computeBackoffMs };
