'use strict';

class L1CacheRepository {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  }

  set(key, value, ttlSeconds) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { value, expiresAt });
  }

  del(key) {
    this.store.delete(key);
  }
}

module.exports = { L1CacheRepository };
