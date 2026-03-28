'use strict';

const { bootstrapApp } = require('./src/bootstrap/app.bootstrap');

bootstrapApp()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[bot] bootstrap failed', error);
    process.exitCode = 1;
  });
