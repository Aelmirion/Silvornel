'use strict';

class L1CacheRepository {
  constructor() {
    this.store = new Map();
  }

  get(_key) {
    return null;
  }

  set(_key, _value, _ttlSeconds) {}

  del(_key) {}
}

module.exports = { L1CacheRepository };
