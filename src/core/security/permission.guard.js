'use strict';

const { hasPermission, requiredPermissionForCommand } = require('../../domain/rules/permission.rules');

class PermissionGuard {
  canExecute(context) {
    const requiredPermission = requiredPermissionForCommand(context?.commandName);

    if (!requiredPermission) {
      return true;
    }

    return hasPermission(context, requiredPermission);
  }
}

module.exports = { PermissionGuard };
