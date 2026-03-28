'use strict';

function resolveThrottlePolicy(_commandName) {
  return { limit: 5, windowSeconds: 10 };
}

module.exports = { resolveThrottlePolicy };
