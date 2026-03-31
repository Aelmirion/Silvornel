'use strict';

const moderationSql = Object.freeze({
  ensureModerationActionsTable: `
    CREATE TABLE IF NOT EXISTS moderation_actions (
      moderation_action_id VARCHAR(128) PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      correlation_id VARCHAR(128) NULL,
      causation_id VARCHAR(128) NULL,
      created_at VARCHAR(40) NOT NULL
    )
  `,
  insertModerationAction: `
    INSERT INTO moderation_actions (moderation_action_id, guild_id, user_id, action_type, correlation_id, causation_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ensureEventOutboxTable: `
    CREATE TABLE IF NOT EXISTS event_outbox (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_id VARCHAR(128) NOT NULL UNIQUE,
      destination VARCHAR(64) NOT NULL,
      event_type VARCHAR(128) NOT NULL,
      payload TEXT NOT NULL,
      status VARCHAR(32) NOT NULL,
      correlation_id VARCHAR(128) NULL,
      causation_id VARCHAR(128) NULL,
      created_at VARCHAR(40) NOT NULL,
      published_at VARCHAR(40) NULL
    )
  `,
  insertOutboxEvent: `
    INSERT INTO event_outbox (event_id, destination, event_type, payload, status, correlation_id, causation_id, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
  `,
  markOutboxPublished: `
    UPDATE event_outbox
    SET status = 'published', published_at = ?
    WHERE event_id = ?
  `,
  getPendingOutboxEvents: `
    SELECT event_id, destination, event_type, payload, correlation_id, causation_id, created_at
    FROM event_outbox
    WHERE status = 'pending'
    ORDER BY id ASC
    LIMIT ?
  `,
  createWarning: `
    INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  incrementWarningCount: `
    INSERT INTO warning_counts (guild_id, user_id, warnings)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE warnings = warnings + 1
  `,
  getWarningCount: 'SELECT warnings FROM warning_counts WHERE guild_id = ? AND user_id = ? LIMIT 1',
  getWarningsByUser: `
    SELECT id, guild_id, user_id, moderator_id, reason, created_at
    FROM warnings
    WHERE guild_id = ? AND user_id = ?
    ORDER BY created_at DESC, id DESC
  `,
  deleteWarningsByUser: 'DELETE FROM warnings WHERE guild_id = ? AND user_id = ?',
  resetWarningCount: `
    INSERT INTO warning_counts (guild_id, user_id, warnings)
    VALUES (?, ?, 0)
    ON DUPLICATE KEY UPDATE warnings = 0
  `
});

module.exports = { moderationSql };
