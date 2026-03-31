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
    this.schemaReady = false;
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

  async ensureReliabilitySchema(connection) {
    if (this.schemaReady) {
      return;
    }

    await withTimeout(
      () => connection.query(this.moderationSql.ensureModerationActionsTable),
      EXTERNAL_TIMEOUT_MS,
      'db.query.ensureModerationActionsTable'
    );
    await withTimeout(
      () => connection.query(this.moderationSql.ensureEventOutboxTable),
      EXTERNAL_TIMEOUT_MS,
      'db.query.ensureEventOutboxTable'
    );
    await withTimeout(
      () => connection.query(this.moderationSql.ensureModerationEffectExecutionsTable),
      EXTERNAL_TIMEOUT_MS,
      'db.query.ensureModerationEffectExecutionsTable'
    );
    this.schemaReady = true;
  }

  async createWarning(warning, tx = null) {
    const { warning: createdWarning } = await this.createWarningWithCount(warning, tx);
    return createdWarning;
  }

  async createWarningWithCount(warning, tx = null) {
    const warningModel = warning instanceof Warning ? warning : new Warning(warning);

    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
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

  async registerModerationAction({ moderationActionId, guildId, userId, actionType, correlationId = null, causationId = null }, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
      try {
        await withTimeout(
          () => connection.query(
            this.moderationSql.insertModerationAction,
            [moderationActionId, guildId, userId, actionType, correlationId, causationId, new Date().toISOString()]
          ),
          EXTERNAL_TIMEOUT_MS,
          'db.query.insertModerationAction'
        );
        return true;
      } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || String(error.message || '').includes('Duplicate'))) {
          return false;
        }
        throw error;
      }
    }, 'registerModerationAction');
  }

  async createOutboxEvent({ eventId, destination, eventType, payload, correlationId = null, causationId = null }, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
      await withTimeout(
        () => connection.query(
          this.moderationSql.insertOutboxEvent,
          [eventId, destination, eventType, JSON.stringify(payload), correlationId, causationId, new Date().toISOString()]
        ),
        EXTERNAL_TIMEOUT_MS,
        'db.query.insertOutboxEvent'
      );
    }, 'createOutboxEvent');
  }

  async registerModerationEffectExecution({
    moderationActionId,
    effectType,
    guildId,
    userId,
    actionType,
    correlationId = null,
    causationId = null
  }, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
      try {
        await withTimeout(
          () => connection.query(
            this.moderationSql.insertModerationEffectExecution,
            [moderationActionId, effectType, guildId, userId, actionType, correlationId, causationId, new Date().toISOString()]
          ),
          EXTERNAL_TIMEOUT_MS,
          'db.query.insertModerationEffectExecution'
        );
        return true;
      } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || String(error.message || '').includes('Duplicate'))) {
          return false;
        }
        throw error;
      }
    }, 'registerModerationEffectExecution');
  }

  async unregisterModerationEffectExecution({ moderationActionId, effectType }, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
      await withTimeout(
        () => connection.query(this.moderationSql.deleteModerationEffectExecution, [moderationActionId, effectType]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.deleteModerationEffectExecution'
      );
    }, 'unregisterModerationEffectExecution');
  }

  async markOutboxPublished(eventId, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await withTimeout(
        () => connection.query(this.moderationSql.markOutboxPublished, [new Date().toISOString(), eventId]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.markOutboxPublished'
      );
    }, 'markOutboxPublished');
  }

  async getPendingOutboxEvents(limit = 20, tx = null) {
    return this.withConnection(tx, async (connection) => {
      await this.ensureReliabilitySchema(connection);
      const rows = await withTimeout(
        () => connection.query(this.moderationSql.getPendingOutboxEvents, [limit]),
        EXTERNAL_TIMEOUT_MS,
        'db.query.getPendingOutboxEvents'
      );
      return rows.map((row) => ({
        eventId: row.event_id,
        destination: row.destination,
        eventType: row.event_type,
        payload: JSON.parse(row.payload),
        correlationId: row.correlation_id,
        causationId: row.causation_id,
        createdAt: row.created_at
      }));
    }, 'getPendingOutboxEvents');
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
