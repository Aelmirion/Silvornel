'use strict';

class UserProfile {
  constructor({ userId, bio = '', preferences = {}, createdAt = null, updatedAt = null }) {
    this.userId = userId;
    this.bio = bio;
    this.preferences = preferences;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = { UserProfile };
