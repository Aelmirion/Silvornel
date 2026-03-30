'use strict';

const { GuildRepositoryContract } = require('../../domain/contracts/guild.repository.contract');

class GuildRepository extends GuildRepositoryContract {
  constructor({ pool, guildSql }) {
    super();
    this.pool = pool;
    this.guildSql = guildSql;
  }
}

module.exports = { GuildRepository };
