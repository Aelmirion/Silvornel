'use strict';

const { withTimeout } = require('./timeout');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.options = {
      timeoutMs: options.timeoutMs || 2_000,
      ...options
    };
    this.state = 'CLOSED';
  }

  async execute(fn, metadata = {}) {
    const label = metadata.label || this.name;
    return withTimeout(fn, this.options.timeoutMs, label);
  }
}

module.exports = { CircuitBreaker };
