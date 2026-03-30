'use strict';

class TransactionManager {
  constructor({ pool }) {
    this.pool = pool;
    this.hasWarnedNoop = false;
  }

  warnNoop() {
    if (this.hasWarnedNoop) {
      return;
    }

    this.hasWarnedNoop = true;
    console.warn('[TransactionManager] runInTransaction is a NO-OP. Operations are executed without transactional guarantees.');
  }

  async runInTransaction(handler) {
    this.warnNoop();
    return handler(null);
  }
}

module.exports = { TransactionManager };
