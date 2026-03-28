'use strict';

const { UserRepositoryContract } = require('../../domain/contracts/user.repository.contract');
const { UserProfile } = require('../../domain/models/UserProfile');
const { withTimeout } = require('../../core/utils/timeout');

const EXTERNAL_TIMEOUT_MS = 2_000;

class UserRepository extends UserRepositoryContract {
  constructor({ pool, userSql }) {
    super();
    this.pool = pool;
    this.userSql = userSql;
  }

  async findByDiscordId(discordId) {
    const connection = await withTimeout(() => this.pool.getConnection(), EXTERNAL_TIMEOUT_MS, 'db.getConnection.findByDiscordId');
    try {
      const rows = await withTimeout(
        () => connection.query(this.userSql.findByDiscordId, [discordId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.findByDiscordId'
      );

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
    const connection = await withTimeout(() => this.pool.getConnection(), EXTERNAL_TIMEOUT_MS, 'db.getConnection.upsert');
    try {
      await withTimeout(
        () => connection.query(this.userSql.upsert, [userProfile.userId, userProfile.displayName]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.upsert'
      );
      return userProfile;
    } finally {
      connection.release();
    }
  }
}

module.exports = { UserRepository };
