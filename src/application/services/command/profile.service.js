'use strict';

const { UserProfile } = require('../../../domain/models/UserProfile');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');

class ProfileService {
  constructor({ userRepository, userCacheRepository, pubSubService }) {
    this.userRepository = userRepository;
    this.userCacheRepository = userCacheRepository;
    this.pubSubService = pubSubService;
  }

  resolveAction(options = []) {
    const actionOption = options.find((option) => option.name === 'action');
    if (actionOption?.value === 'set') return 'set';
    const subCommandOption = options.find((option) => Array.isArray(option.options));
    if (subCommandOption?.name === 'set') return 'set';
    return 'get';
  }

  resolveDisplayName(options = [], fallback) {
    const directOption = options.find((option) => option.name === 'display_name' && typeof option.value === 'string');
    if (directOption) return directOption.value;

    const subCommandOption = options.find((option) => Array.isArray(option.options));
    const nestedOption = subCommandOption?.options?.find((option) => option.name === 'display_name' && typeof option.value === 'string');
    if (nestedOption) return nestedOption.value;

    return fallback;
  }

  async getProfile(userId) {
    const cachedProfile = await this.userCacheRepository.get(userId);
    if (cachedProfile) {
      return cachedProfile;
    }

    const storedProfile = await this.userRepository.findByDiscordId(userId);
    if (!storedProfile) {
      return null;
    }

    await this.userCacheRepository.set(storedProfile);
    return storedProfile;
  }

  async execute(commandDto) {
    const action = this.resolveAction(commandDto.options);

    if (action === 'set') {
      const displayName = this.resolveDisplayName(commandDto.options, `user-${commandDto.userId}`);
      const profile = new UserProfile({ userId: commandDto.userId, displayName });

      const saved = await this.userRepository.upsert(profile);
      await this.userCacheRepository.invalidate(commandDto.userId);
      await this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, {
        key: this.userCacheRepository.createCacheKey(commandDto.userId)
      });

      return {
        kind: 'interaction.response',
        data: {
          content: `✅ Profile updated: ${saved.displayName}`
        },
        meta: {
          action: 'set',
          userId: commandDto.userId
        }
      };
    }

    const profile = await this.getProfile(commandDto.userId);
    const displayName = profile?.displayName || 'not set';

    return {
      kind: 'interaction.response',
      data: {
        content: `👤 Profile: ${displayName}`
      },
      meta: {
        action: 'get',
        userId: commandDto.userId
      }
    };
  }
}

module.exports = { ProfileService };
