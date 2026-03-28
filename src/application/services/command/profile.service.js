'use strict';

class ProfileService {
  constructor({ userRepository, userCacheRepository }) {
    this.userRepository = userRepository;
    this.userCacheRepository = userCacheRepository;
  }

  async execute(_interactionDto) {
    return null;
  }
}

module.exports = { ProfileService };
