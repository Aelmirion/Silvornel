'use strict';

const userSql = Object.freeze({
  findByDiscordId: 'SELECT user_id, bio, preferences_json, created_at, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1',
  create: 'INSERT INTO user_profiles (user_id, bio, preferences_json) VALUES (?, ?, ?)',
  update: 'UPDATE user_profiles SET bio = ?, preferences_json = ? WHERE user_id = ?'
});

module.exports = { userSql };
