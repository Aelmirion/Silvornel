'use strict';

const path = require('path');
const { ShardingManager } = require('discord.js');
const { createEnvConfig } = require('./src/config/env');

const env = createEnvConfig(process.env);

const manager = new ShardingManager(path.join(__dirname, 'bot.js'), {
  token: env.discord.token,
  totalShards: env.sharding.totalShards,
  respawn: true,
  shardArgs: []
});

manager.on('shardCreate', (shard) => {
  // eslint-disable-next-line no-console
  console.log(`[sharding] shard ${shard.id} created`);
});

manager.spawn({
  amount: env.sharding.totalShards,
  delay: env.sharding.spawnDelayMs,
  timeout: env.sharding.spawnTimeoutMs
});
