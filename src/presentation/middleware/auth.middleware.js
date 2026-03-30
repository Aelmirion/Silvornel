'use strict';

const { DomainError } = require('../../core/errors/DomainError');
const { PermissionGuard } = require('../../core/security/permission.guard');

const permissionGuard = new PermissionGuard();

async function authMiddleware(ctx, next) {
  if (!permissionGuard.canExecute(ctx)) {
    throw new DomainError('You do not have permission to execute this command.', 'AUTH_FORBIDDEN');
  }

  return next(ctx);
}

module.exports = { authMiddleware };
