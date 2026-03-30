'use strict';

const { InteractionDto } = require('../../presentation/dto/interaction.dto');

function extractMemberRoles(interaction) {
  const roles = interaction?.member?.roles;

  if (!roles) {
    return [];
  }

  if (Array.isArray(roles)) {
    return roles.filter((role) => typeof role === 'string');
  }

  const roleCache = roles.cache;
  if (!roleCache || typeof roleCache.values !== 'function') {
    return [];
  }

  return Array.from(roleCache.values())
    .map((role) => role?.name)
    .filter((roleName) => typeof roleName === 'string' && roleName.trim().length > 0);
}

function extractMemberPermissions(interaction) {
  if (!interaction?.memberPermissions || typeof interaction.memberPermissions.toArray !== 'function') {
    return [];
  }

  return interaction.memberPermissions.toArray();
}

class InteractionMapper {
  toDto(interaction) {
    return new InteractionDto({
      id: interaction.id,
      type: interaction.type,
      commandName: interaction.commandName,
      userId: interaction.user?.id || null,
      guildId: interaction.guildId || null,
      options: interaction.options?.data || [],
      memberPermissions: extractMemberPermissions(interaction),
      memberRoles: extractMemberRoles(interaction),
      isGuildOwner: interaction.guild?.ownerId === interaction.user?.id,
      payload: null
    });
  }
}

module.exports = { InteractionMapper };
