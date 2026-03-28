'use strict';

function createTraceContext(seed = '') {
  return {
    traceId: seed || `trace_${Date.now()}`
  };
}

module.exports = { createTraceContext };
