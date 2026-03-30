'use strict';

class WarningRepositoryContract {
  async create(_warning) {
    throw new Error('Not implemented');
  }

  async listByUser(_userId) {
    throw new Error('Not implemented');
  }
}

module.exports = { WarningRepositoryContract };
