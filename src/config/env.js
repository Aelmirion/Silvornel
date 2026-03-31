'use strict';

const { CONFIG_VERSIONS } = require('./constants/config.versions');

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function createEnvConfig(env) {
  return {
    configVersion: parseInteger(env.CONFIG_VERSION, CONFIG_VERSIONS.current),
    eventSchemaVersion: parseInteger(env.EVENT_SCHEMA_VERSION, 1),
    discord: {
      token: env.DISCORD_TOKEN || '',
      applicationId: env.DISCORD_APPLICATION_ID || '',
      guildId: env.DISCORD_GUILD_ID || ''
    },
    sharding: {
      totalShards: env.SHARD_COUNT || 'auto',
      spawnDelayMs: parseInteger(env.SHARD_SPAWN_DELAY_MS, 5500),
      spawnTimeoutMs: parseInteger(env.SHARD_SPAWN_TIMEOUT_MS, 30000)
    },
    db: {
      host: env.MARIADB_HOST || '127.0.0.1',
      port: parseInteger(env.MARIADB_PORT, 3306),
      user: env.MARIADB_USER || '',
      password: env.MARIADB_PASSWORD || '',
      database: env.MARIADB_DATABASE || '',
      connectionLimit: parseInteger(env.MARIADB_CONNECTION_LIMIT, 10),
      connectTimeoutMs: parseInteger(env.MARIADB_CONNECT_TIMEOUT_MS, 5000),
      acquireTimeoutMs: parseInteger(env.MARIADB_ACQUIRE_TIMEOUT_MS, 5000)
    },
    redis: {
      url: env.REDIS_URL || 'redis://127.0.0.1:6379',
      maxRetryAttempts: parseInteger(env.REDIS_MAX_RETRY_ATTEMPTS, 10),
      retryBaseMs: parseInteger(env.REDIS_RETRY_BASE_MS, 100),
      durabilityMode: env.REDIS_DURABILITY_MODE || 'best_effort'
    },
    queue: {
      executionMode: env.QUEUE_EXECUTION_MODE || 'in_shard',
      maxLength: parseInteger(env.QUEUE_MAX_LENGTH, 1000),
      retryBaseMs: parseInteger(env.QUEUE_RETRY_BASE_MS, 1000),
      maxAttempts: parseInteger(env.QUEUE_MAX_ATTEMPTS, 5)
    },
    runtime: {
      externalCallTimeoutMs: parseInteger(env.EXTERNAL_CALL_TIMEOUT_MS, 2000)
    }
  };
}

module.exports = { createEnvConfig };
