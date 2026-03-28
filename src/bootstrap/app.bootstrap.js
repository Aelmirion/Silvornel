'use strict';

const { createContainer } = require('../container');
const { bootstrapShard } = require('./shard.bootstrap');

async function bootstrapApp() {
  const container = createContainer();
  await bootstrapShard({ container });
}

module.exports = { bootstrapApp };
