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

  mapRowToModel(row) {
    return new UserProfile({
      userId: row.user_id,
      bio: row.bio,
      preferences: row.preferences_json ? JSON.parse(row.preferences_json) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  async withConnection(tx, handler, label) {
    if (tx) {
      return handler(tx);
    }

    const connection = await withTimeout(() => this.pool.getConnection(), EXTERNAL_TIMEOUT_MS, `db.getConnection.${label}`);
    try {
      return await handler(connection);
    } finally {
      connection.release();
    }
  }

  async findByDiscordId(discordId, tx = null) {
    return this.withConnection(tx, async (connection) => {
      const rows = await withTimeout(
        () => connection.query(this.userSql.findByDiscordId, [discordId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.findByDiscordId'
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.mapRowToModel(rows[0]);
    }, 'findByDiscordId');
  }

  async create(userProfile, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await withTimeout(
        () => connection.query(this.userSql.create, [userProfile.userId, userProfile.bio, JSON.stringify(userProfile.preferences)]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.create'
      );

      return this.findByDiscordId(userProfile.userId, tx || connection);
    }, 'create');
  }

  async update(userProfile, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await withTimeout(
        () => connection.query(this.userSql.update, [userProfile.bio, JSON.stringify(userProfile.preferences), userProfile.userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.update'
      );

      return this.findByDiscordId(userProfile.userId, tx || connection);
    }, 'update');
  }
}

module.exports = { UserRepository };
