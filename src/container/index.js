'use strict';

const { Container } = require('./scopes/singleton.scope');
const { TOKENS } = require('./tokens');
const { registerCoreModule } = require('./modules/core.module');
const { registerAdapterModule } = require('./modules/adapter.module');
const { registerInfraModule } = require('./modules/infra.module');
const { registerAppModule } = require('./modules/app.module');
const { registerPresentationModule } = require('./modules/presentation.module');

function createContainer() {
  const container = new Container();
  registerCoreModule(container);
  registerAdapterModule(container);
  registerInfraModule(container);
  registerAppModule(container);
  registerPresentationModule(container);
  return container;
}

function validateContainer(container) {
  for (const token of Object.values(TOKENS)) {
    if (!container.has(token)) {
      throw new Error(`Startup validation failed: token not bound (${token})`);
    }
  }

  const registry = container.resolve(TOKENS.ControllerRegistry);
  registry.validateCompleteness();
}

module.exports = { createContainer, validateContainer };
