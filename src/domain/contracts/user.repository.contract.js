'use strict';

class UserRepositoryContract {
  async findByDiscordId(_discordId) {
    throw new Error('Not implemented');
  }

  async upsert(_userProfile) {
    throw new Error('Not implemented');
  }
}

module.exports = { UserRepositoryContract };
