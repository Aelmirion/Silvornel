'use strict';

const { WarningRepositoryContract } = require('../../domain/contracts/warning.repository.contract');

class WarningRepository extends WarningRepositoryContract {
  constructor({ pool, moderationSql }) {
    super();
    this.pool = pool;
    this.moderationSql = moderationSql;
  }
}

module.exports = { WarningRepository };
