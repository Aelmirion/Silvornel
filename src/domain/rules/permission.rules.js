'use strict';

const DOMAIN_PERMISSIONS = Object.freeze({
  MODERATION: 'MODERATION'
});

const COMMAND_PERMISSION_MAP = Object.freeze({
  moderation: DOMAIN_PERMISSIONS.MODERATION,
  warn: DOMAIN_PERMISSIONS.MODERATION,
  warnings: DOMAIN_PERMISSIONS.MODERATION,
  clearwarnings: DOMAIN_PERMISSIONS.MODERATION
});

const DISCORD_PERMISSION_MAP = Object.freeze({
  [DOMAIN_PERMISSIONS.MODERATION]: ['Administrator', 'ModerateMembers', 'ManageMessages']
});

const DISCORD_ROLE_MAP = Object.freeze({
  [DOMAIN_PERMISSIONS.MODERATION]: ['admin', 'administrator', 'mod', 'moderator']
});

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function requiredPermissionForCommand(commandName) {
  if (typeof commandName !== 'string') {
    return null;
  }

  return COMMAND_PERMISSION_MAP[commandName] || null;
}

function hasPermission(context, permission) {
  if (!permission || !DISCORD_PERMISSION_MAP[permission]) {
    return true;
  }

  if (!context || typeof context !== 'object') {
    return false;
  }

  if (context.isGuildOwner === true) {
    return true;
  }

  const memberPermissions = normalizeStringArray(context.memberPermissions);
  if (memberPermissions.includes('Administrator')) {
    return true;
  }

  const acceptedDiscordPermissions = DISCORD_PERMISSION_MAP[permission];
  const hasAcceptedDiscordPermission = acceptedDiscordPermissions
    .some((discordPermission) => memberPermissions.includes(discordPermission));

  if (hasAcceptedDiscordPermission) {
    return true;
  }

  const memberRoles = normalizeStringArray(context.memberRoles)
    .map((roleName) => roleName.toLowerCase());
  const acceptedRoles = DISCORD_ROLE_MAP[permission] || [];

  return acceptedRoles.some((roleName) => memberRoles.includes(roleName));
}

module.exports = {
  DOMAIN_PERMISSIONS,
  requiredPermissionForCommand,
  hasPermission
};
