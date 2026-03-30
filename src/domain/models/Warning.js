'use strict';

class Warning {
  constructor({ id, userId, reason }) {
    this.id = id;
    this.userId = userId;
    this.reason = reason;
  }
}

module.exports = { Warning };
