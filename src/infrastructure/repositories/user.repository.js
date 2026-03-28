'use strict';

const { UserRepositoryContract } = require('../../domain/contracts/user.repository.contract');

class UserRepository extends UserRepositoryContract {
  constructor({ pool, userSql }) {
    super();
    this.pool = pool;
    this.userSql = userSql;
  }
}

module.exports = { UserRepository };
