'use strict';

const { randomUUID } = require('crypto');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');
const { EVENT_SCHEMA } = require('../../../config/constants/event.schema');
const { createDefaultProfile, applyProfileUpdate } = require('../../../domain/rules/profile.rules');

class ProfileService {
  constructor({ userRepository, userCacheRepository, pubSubService }) {
    this.userRepository = userRepository;
    this.userCacheRepository = userCacheRepository;
    this.pubSubService = pubSubService;
  }

  async ensureProfileExists(userId) {
    const existing = await this.userRepository.findByDiscordId(userId);
    if (existing) {
      return existing;
    }

    const defaultProfile = createDefaultProfile(userId);
    return this.userRepository.create(defaultProfile);
  }

  async getProfile(profileDto) {
    const cachedProfile = await this.userCacheRepository.getProfile(profileDto.userId);
    if (cachedProfile) {
      return {
        kind: 'interaction.response',
        data: {
          content: `👤 Profile\nBio: ${cachedProfile.bio}`
        },
        meta: { action: 'get', source: 'cache', userId: profileDto.userId }
      };
    }

    const persistedProfile = await this.ensureProfileExists(profileDto.userId);
    await this.userCacheRepository.setProfile(profileDto.userId, persistedProfile, 180);

    return {
      kind: 'interaction.response',
      data: {
        content: `👤 Profile\nBio: ${persistedProfile.bio}`
      },
      meta: { action: 'get', source: 'db', userId: profileDto.userId }
    };
  }

  async updateProfile(profileDto) {
    const current = await this.ensureProfileExists(profileDto.userId);
    const updated = applyProfileUpdate(current, profileDto);
    const saved = await this.userRepository.update(updated);

    await this.userCacheRepository.deleteProfile(profileDto.userId);
    await this.pubSubService.publish(REDIS_CHANNELS.cacheInvalidate, {
      eventId: randomUUID(),
      schemaVersion: EVENT_SCHEMA.current,
      userId: profileDto.userId
    });

    return {
      kind: 'interaction.response',
      data: {
        content: `✅ Profile updated\nBio: ${saved.bio}`
      },
      meta: { action: 'set', userId: profileDto.userId }
    };
  }

  async execute(profileDto) {
    if (profileDto.action === 'set') {
      return this.updateProfile(profileDto);
    }

    return this.getProfile(profileDto);
  }
}

module.exports = { ProfileService };
