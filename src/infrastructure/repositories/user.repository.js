'use strict';

const { UserRepositoryContract } = require('../../domain/contracts/user.repository.contract');
const { UserProfile } = require('../../domain/models/UserProfile');

class UserRepository extends UserRepositoryContract {
  constructor({ pool, userSql }) {
    super();
    this.pool = pool;
    this.userSql = userSql;
  }

  async findByDiscordId(discordId) {
    const connection = await this.pool.getConnection();
    try {
      const rows = await connection.query(this.userSql.findByDiscordId, [discordId]);
      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return new UserProfile({
        userId: row.user_id,
        displayName: row.display_name
      });
    } finally {
      connection.release();
    }
  }

  async upsert(userProfile) {
    const connection = await this.pool.getConnection();
    try {
      await connection.query(this.userSql.upsert, [userProfile.userId, userProfile.displayName]);
      return userProfile;
    } finally {
      connection.release();
    }
  }
}

module.exports = { UserRepository };
