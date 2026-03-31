'use strict';

class Metrics {
  constructor() {
    this.counters = new Map();
    this.timings = new Map();
  }

  increment(name, tags = {}) {
    const key = this.#key(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  timing(name, valueMs, tags = {}) {
    const key = this.#key(name, tags);
    const bucket = this.timings.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
    bucket.count += 1;
    bucket.totalMs += valueMs;
    bucket.maxMs = Math.max(bucket.maxMs, valueMs);
    this.timings.set(key, bucket);
  }

  snapshot() {
    return {
      counters: Object.fromEntries(this.counters.entries()),
      timings: Object.fromEntries(this.timings.entries())
    };
  }

  #key(name, tags = {}) {
    const stableTags = Object.entries(tags)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    if (stableTags.length === 0) {
      return name;
    }

    const serializedTags = stableTags
      .map(([tagName, tagValue]) => `${tagName}=${String(tagValue)}`)
      .join(',');

    return `${name}|${serializedTags}`;
  }
}

module.exports = { Metrics };
