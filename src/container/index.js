'use strict';

const { Container } = require('./scopes/singleton.scope');
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

module.exports = { createContainer };
