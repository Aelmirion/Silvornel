'use strict';

const userSql = Object.freeze({
  findByDiscordId: 'SELECT user_id, display_name FROM user_profiles WHERE user_id = ? LIMIT 1',
  upsert: 'INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)'
});

module.exports = { userSql };
