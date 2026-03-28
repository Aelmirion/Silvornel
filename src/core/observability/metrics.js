'use strict';

class Metrics {
  increment(name, tags = {}) {}
  timing(name, valueMs, tags = {}) {}
}

module.exports = { Metrics };
