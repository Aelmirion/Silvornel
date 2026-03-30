'use strict';

class GuildRepositoryContract {
  async findById(_id) {
    throw new Error('Not implemented');
  }

  async upsert(_guild) {
    throw new Error('Not implemented');
  }
}

module.exports = { GuildRepositoryContract };
