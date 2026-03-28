'use strict';

const mariadb = require('mariadb');

function createMariaDbPool(config) {
  return mariadb.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit
  });
}

module.exports = { createMariaDbPool };
