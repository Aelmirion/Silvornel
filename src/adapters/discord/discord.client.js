'use strict';

const { Client } = require('discord.js');

function createDiscordClient(config) {
  return new Client({
    intents: config.intents,
    partials: config.partials,
    presence: config.presence
  });
}

module.exports = { createDiscordClient };
