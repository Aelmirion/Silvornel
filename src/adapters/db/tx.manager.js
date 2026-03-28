'use strict';

class TransactionManager {
  constructor({ pool }) {
    this.pool = pool;
  }

  async runInTransaction(handler) {
    return handler({});
  }
}

module.exports = { TransactionManager };
