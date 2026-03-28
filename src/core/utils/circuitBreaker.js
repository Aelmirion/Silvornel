'use strict';

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.state = 'CLOSED';
  }

  async execute(fn) {
    return fn();
  }
}

module.exports = { CircuitBreaker };
