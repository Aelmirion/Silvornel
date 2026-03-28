'use strict';

class PermissionGuard {
  canExecute(_context) {
    return true;
  }
}

module.exports = { PermissionGuard };
