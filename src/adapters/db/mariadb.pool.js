'use strict';

const mariadb = require('mariadb');

function createMariaDbPool(config) {
  return mariadb.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    acquireTimeout: config.acquireTimeout,
    connectTimeout: config.connectTimeout,
    idleTimeout: 60_000,
    minimumIdle: 1
  });
}

module.exports = { createMariaDbPool };
