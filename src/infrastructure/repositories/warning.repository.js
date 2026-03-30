'use strict';

const { WarningRepositoryContract } = require('../../domain/contracts/warning.repository.contract');
const { Warning } = require('../../domain/models/Warning');
const { withTimeout } = require('../../core/utils/timeout');

const EXTERNAL_TIMEOUT_MS = 2_000;

class WarningRepository extends WarningRepositoryContract {
  constructor({ pool, moderationSql }) {
    super();
    this.pool = pool;
    this.moderationSql = moderationSql;
  }

  mapRowToModel(row) {
    return new Warning({
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      moderatorId: row.moderator_id,
      reason: row.reason,
      createdAt: row.created_at
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

  async createWarning(warning, tx = null) {
    const { warning: createdWarning } = await this.createWarningWithCount(warning, tx);
    return createdWarning;
  }

  async createWarningWithCount(warning, tx = null) {
    const warningModel = warning instanceof Warning ? warning : new Warning(warning);

    return this.withConnection(tx, async (connection) => {
      const createdAt = warningModel.createdAt || new Date().toISOString();

      const result = await withTimeout(
        () => connection.query(
          this.moderationSql.createWarning,
          [warningModel.guildId, warningModel.userId, warningModel.moderatorId, warningModel.reason, createdAt]
        ),
        EXTERNAL_TIMEOUT_MS,
        'db.query.createWarning'
      );

      await withTimeout(
        () => connection.query(this.moderationSql.incrementWarningCount, [warningModel.guildId, warningModel.userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.incrementWarningCount'
      );

      const rows = await withTimeout(
        () => connection.query(this.moderationSql.getWarningCount, [warningModel.guildId, warningModel.userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.getWarningCount'
      );

      const warningCount = Number(rows?.[0]?.warnings ?? 0);

      return {
        warning: new Warning({
          id: result.insertId,
          guildId: warningModel.guildId,
          userId: warningModel.userId,
          moderatorId: warningModel.moderatorId,
          reason: warningModel.reason,
          createdAt
        }),
        warningCount
      };
    }, 'createWarningWithCount');
  }

  async getWarningsByUser(guildId, userId, tx = null) {
    return this.withConnection(tx, async (connection) => {
      const rows = await withTimeout(
        () => connection.query(this.moderationSql.getWarningsByUser, [guildId, userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.getWarningsByUser'
      );

      return rows.map((row) => this.mapRowToModel(row));
    }, 'getWarningsByUser');
  }

  async deleteWarningsByUser(guildId, userId, tx = null) {
    return this.withConnection(tx, async (connection) => {
      const result = await withTimeout(
        () => connection.query(this.moderationSql.deleteWarningsByUser, [guildId, userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.deleteWarningsByUser'
      );

      return result.affectedRows || 0;
    }, 'deleteWarningsByUser');
  }

  async resetWarningCount(guildId, userId, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await withTimeout(
        () => connection.query(this.moderationSql.resetWarningCount, [guildId, userId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.resetWarningCount'
      );
    }, 'resetWarningCount');
  }
}

module.exports = { WarningRepository };
