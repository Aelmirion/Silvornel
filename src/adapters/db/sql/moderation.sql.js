'use strict';

const moderationSql = Object.freeze({
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
