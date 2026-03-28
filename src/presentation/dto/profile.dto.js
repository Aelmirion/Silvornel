'use strict';

const { DomainError } = require('../../core/errors/DomainError');

class ProfileDto {
  constructor({ userId, guildId, action, bio = null, preferences = null }) {
    this.userId = userId;
    this.guildId = guildId;
    this.action = action;
    this.bio = bio;
    this.preferences = preferences;
  }

  static fromCommand(commandDto) {
    if (!commandDto?.userId) {
      throw new DomainError('User ID is required', 'PROFILE_MISSING_USER_ID');
    }

    const options = commandDto.options || [];
    const subCommand = options.find((option) => Array.isArray(option.options));
    const action = subCommand?.name === 'set' ? 'set' : 'get';

    const nestedOptions = subCommand?.options || options;
    const bioOption = nestedOptions.find((option) => option.name === 'bio');
    const preferencesOption = nestedOptions.find((option) => option.name === 'preferences');

    let preferences = null;
    if (typeof preferencesOption?.value === 'string' && preferencesOption.value.trim().length > 0) {
      try {
        preferences = JSON.parse(preferencesOption.value);
      } catch (_error) {
        throw new DomainError('Invalid preferences JSON', 'PROFILE_INVALID_PREFERENCES_JSON');
      }
    }

    return new ProfileDto({
      userId: commandDto.userId,
      guildId: commandDto.guildId,
      action,
      bio: typeof bioOption?.value === 'string' ? bioOption.value : null,
      preferences
    });
  }
}

module.exports = { ProfileDto };
