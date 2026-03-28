'use strict';

class UserRepositoryContract {
  async findByDiscordId(_discordId, _tx = null) {
    throw new Error('Not implemented');
  }

  async create(_userProfile, _tx = null) {
    throw new Error('Not implemented');
  }

  async update(_userProfile, _tx = null) {
    throw new Error('Not implemented');
  }
}

module.exports = { UserRepositoryContract };
