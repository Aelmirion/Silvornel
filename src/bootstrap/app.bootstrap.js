'use strict';

const { createContainer, validateContainer } = require('../container');
const { bootstrapShard } = require('./shard.bootstrap');

async function bootstrapApp() {
  const container = createContainer();
  validateContainer(container);
  await bootstrapShard({ container });
}

module.exports = { bootstrapApp };
