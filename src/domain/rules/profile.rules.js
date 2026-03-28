'use strict';

const { DomainError } = require('../../core/errors/DomainError');
const { UserProfile } = require('../models/UserProfile');

function validateBio(bio) {
  if (typeof bio !== 'string') {
    throw new DomainError('Bio must be a string', 'PROFILE_INVALID_BIO');
  }

  if (bio.length > 190) {
    throw new DomainError('Bio exceeds max length', 'PROFILE_INVALID_BIO_LENGTH');
  }
}

function validatePreferences(preferences) {
  if (preferences === null || preferences === undefined) {
    return;
  }

  if (typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new DomainError('Preferences must be an object', 'PROFILE_INVALID_PREFERENCES');
  }
}

function createDefaultProfile(userId) {
  return new UserProfile({
    userId,
    bio: 'This user has not set a bio yet.',
    preferences: { theme: 'default', notifications: true }
  });
}

function applyProfileUpdate(existingProfile, profileDto) {
  validateBio(profileDto.bio);
  validatePreferences(profileDto.preferences);

  return new UserProfile({
    userId: existingProfile.userId,
    bio: profileDto.bio ?? existingProfile.bio,
    preferences: profileDto.preferences ?? existingProfile.preferences,
    createdAt: existingProfile.createdAt,
    updatedAt: new Date().toISOString()
  });
}

module.exports = {
  validateBio,
  validatePreferences,
  createDefaultProfile,
  applyProfileUpdate
};
