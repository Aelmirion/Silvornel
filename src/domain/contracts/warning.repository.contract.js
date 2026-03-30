'use strict';

class WarningRepositoryContract {
  async createWarning(_warning) {
    throw new Error('Not implemented');
  }

  async getWarningsByUser(_guildId, _userId) {
    throw new Error('Not implemented');
  }

  async deleteWarningsByUser(_guildId, _userId) {
    throw new Error('Not implemented');
  }
}

module.exports = { WarningRepositoryContract };
