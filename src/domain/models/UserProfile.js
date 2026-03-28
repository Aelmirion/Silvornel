'use strict';

class UserProfile {
  constructor({ userId, displayName }) {
    this.userId = userId;
    this.displayName = displayName;
  }
}

module.exports = { UserProfile };
