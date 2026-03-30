'use strict';

const moderationSql = Object.freeze({
  createWarning: `
    INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  getWarningsByUser: `
    SELECT id, guild_id, user_id, moderator_id, reason, created_at
    FROM warnings
    WHERE guild_id = ? AND user_id = ?
    ORDER BY created_at DESC, id DESC
  `,
  deleteWarningsByUser: 'DELETE FROM warnings WHERE guild_id = ? AND user_id = ?'
});

module.exports = { moderationSql };
