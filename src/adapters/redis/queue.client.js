'use strict';

const { randomUUID } = require('crypto');

class QueueClient {
  constructor({ redisClient, circuitBreaker, envConfig, logger }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
    this.envConfig = envConfig;
    this.logger = logger;
    this.defaultVisibilityTimeoutMs = 30_000;
    this.requeueBatchSize = 25;
    this.delayedBatchSize = 25;
    const keyPrefix = this.envConfig?.redis?.keyPrefix || process.env.REDIS_KEY_PREFIX || '';
    this.delayedQueueKeyName = `${keyPrefix}delayed_jobs`;

    // Queue safety note: Redis persistence is required for crash durability.
    // If AOF is not enabled on Redis, this queue is at-most-memory and jobs can be lost on Redis restart.
    if (this.envConfig?.redis?.durabilityMode !== 'aof_required') {
      this.logger?.warn?.('Redis queue durability guard: REDIS_DURABILITY_MODE is not set to aof_required. Queue correctness depends on Redis AOF for crash durability.');
    }
  }

  processingQueueKey(queueName) {
    return `${queueName}:processing`;
  }

  processingItemsKey(queueName) {
    return `${queueName}:processing:items`;
  }

  visibilityKey(queueName) {
    return `${queueName}:processing:visibility`;
  }

  delayedQueueKey() {
    return this.delayedQueueKeyName;
  }

  async enqueue(queueName, job, options = {}) {
    return this.circuitBreaker.execute(
      async () => {
        const rawJob = JSON.stringify(job);
        const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : null;

        if (maxLength === null) {
          await this.redisClient.rPush(queueName, rawJob);
          return true;
        }

        const accepted = await this.redisClient.eval(
          [
            'local pending = KEYS[1]',
            'local rawJob = ARGV[1]',
            'local maxLength = tonumber(ARGV[2])',
            'local currentLength = redis.call("LLEN", pending)',
            'if currentLength >= maxLength then',
            '  return 0',
            'end',
            'redis.call("RPUSH", pending, rawJob)',
            'return 1'
          ].join('\n'),
          {
            keys: [queueName],
            arguments: [rawJob, String(maxLength)]
          }
        );

        return Number(accepted) === 1;
      },
      { label: `redis.queue.enqueue:${queueName}` }
    );
  }

  async enqueueAt(queueName, job, executeAtMs) {
    return this.circuitBreaker.execute(
      async () => {
        const delayedJob = {
          delayedJobId: randomUUID(),
          queueName,
          rawJob: JSON.stringify(job)
        };

        await this.redisClient.zAdd(this.delayedQueueKey(), {
          score: Math.max(0, Number(executeAtMs) || 0),
          value: JSON.stringify(delayedJob)
        });
      },
      { label: `redis.queue.enqueueAt:${queueName}` }
    );
  }

  async length(queueName) {
    return this.circuitBreaker.execute(
      async () => this.redisClient.lLen(queueName),
      { label: `redis.queue.length:${queueName}` }
    );
  }

  async reserve(queueName, options = {}) {
    const blockTimeoutSeconds = Number.isInteger(options.blockTimeoutSeconds) ? options.blockTimeoutSeconds : 1;
    const visibilityTimeoutMs = Number.isInteger(options.visibilityTimeoutMs)
      ? options.visibilityTimeoutMs
      : this.defaultVisibilityTimeoutMs;

    return this.circuitBreaker.execute(
      async () => {
        await this.promoteDueDelayedJobs(this.delayedBatchSize);
        await this.requeueExpired(queueName, this.requeueBatchSize);

        const waitDeadlineMs = Date.now() + (Math.max(0, blockTimeoutSeconds) * 1000);
        const pollSleepMs = 50;

        while (true) {
          const reservationToken = randomUUID();
          const visibilityDeadline = Date.now() + Math.max(1_000, visibilityTimeoutMs);

          const rawJob = await this.redisClient.eval(
            [
              'local pending = KEYS[1]',
              'local processingQueue = KEYS[2]',
              'local processingItems = KEYS[3]',
              'local visibility = KEYS[4]',
              'local reservationToken = ARGV[1]',
              'local visibilityDeadline = tonumber(ARGV[2])',
              'local rawJob = redis.call("LPOP", pending)',
              'if not rawJob then',
              '  return false',
              'end',
              'redis.call("RPUSH", processingQueue, rawJob)',
              'redis.call("HSET", processingItems, reservationToken, rawJob)',
              'redis.call("ZADD", visibility, visibilityDeadline, reservationToken)',
              'return rawJob'
            ].join('\n'),
            {
              keys: [
                queueName,
                this.processingQueueKey(queueName),
                this.processingItemsKey(queueName),
                this.visibilityKey(queueName)
              ],
              arguments: [reservationToken, String(visibilityDeadline)]
            }
          );

          if (rawJob) {
            return {
              reservationToken,
              rawJob
            };
          }

          if (Date.now() >= waitDeadlineMs) {
            return null;
          }

          await new Promise((resolve) => setTimeout(resolve, pollSleepMs));
          await this.promoteDueDelayedJobs(this.delayedBatchSize);
          await this.requeueExpired(queueName, this.requeueBatchSize);
        }
      },
      { label: `redis.queue.reserve:${queueName}` }
    );
  }

  async scheduleRetry(queueName, reservationToken, job, executeAtMs) {
    if (!reservationToken) {
      return false;
    }

    return this.circuitBreaker.execute(
      async () => {
        const scheduled = await this.redisClient.eval(
          [
            'local processingQueue = KEYS[1]',
            'local processingItems = KEYS[2]',
            'local visibility = KEYS[3]',
            'local delayedJobs = KEYS[4]',
            'local queueName = ARGV[1]',
            'local reservationToken = ARGV[2]',
            'local executeAtMs = tonumber(ARGV[3])',
            'local delayedJobId = ARGV[4]',
            'local rawRetryJob = ARGV[5]',
            'local rawJob = redis.call("HGET", processingItems, reservationToken)',
            'if not rawJob then',
            '  return 0',
            'end',
            'redis.call("LREM", processingQueue, 1, rawJob)',
            'redis.call("HDEL", processingItems, reservationToken)',
            'redis.call("ZREM", visibility, reservationToken)',
            'local nowTime = redis.call("TIME")',
            'local nowMs = (tonumber(nowTime[1]) * 1000) + math.floor(tonumber(nowTime[2]) / 1000)',
            'local score = executeAtMs',
            'if not score or score < nowMs then',
            '  score = nowMs',
            'end',
            'local delayedValue = cjson.encode({ delayedJobId = delayedJobId, queueName = queueName, rawJob = rawRetryJob })',
            'redis.call("ZADD", delayedJobs, score, delayedValue)',
            'return 1'
          ].join('\n'),
          {
            keys: [
              this.processingQueueKey(queueName),
              this.processingItemsKey(queueName),
              this.visibilityKey(queueName),
              this.delayedQueueKey()
            ],
            arguments: [
              queueName,
              reservationToken,
              String(Math.max(0, Number(executeAtMs) || 0)),
              randomUUID(),
              JSON.stringify(job)
            ]
          }
        );

        return Number(scheduled) === 1;
      },
      { label: `redis.queue.scheduleRetry:${queueName}` }
    );
  }

  async promoteDueDelayedJobs(limit = this.delayedBatchSize) {
    return this.circuitBreaker.execute(
      async () => {
        const safeLimit = Math.max(1, Number(limit) || this.delayedBatchSize);
        const promoted = await this.redisClient.eval(
          [
            'local delayedJobs = KEYS[1]',
            'local limit = tonumber(ARGV[1])',
            'local nowTime = redis.call("TIME")',
            'local nowMs = (tonumber(nowTime[1]) * 1000) + math.floor(tonumber(nowTime[2]) / 1000)',
            'local dueJobs = redis.call("ZRANGEBYSCORE", delayedJobs, "-inf", nowMs, "LIMIT", 0, limit)',
            'local moved = 0',
            'for _, dueJob in ipairs(dueJobs) do',
            '  local removed = redis.call("ZREM", delayedJobs, dueJob)',
            '  if removed == 1 then',
            '    local decoded = cjson.decode(dueJob)',
            '    if decoded and decoded.queueName and decoded.rawJob then',
            '      redis.call("RPUSH", decoded.queueName, decoded.rawJob)',
            '      moved = moved + 1',
            '    end',
            '  end',
            'end',
            'return moved'
          ].join('\n'),
          {
            keys: [this.delayedQueueKey()],
            arguments: [String(safeLimit)]
          }
        );

        return Number(promoted);
      },
      { label: 'redis.queue.promoteDueDelayedJobs' }
    );
  }

  async ack(queueName, reservationToken) {
    if (!reservationToken) {
      return false;
    }

    return this.circuitBreaker.execute(
      async () => {
        const removed = await this.redisClient.eval(
          [
            'local processingQueue = KEYS[1]',
            'local processingItems = KEYS[2]',
            'local visibility = KEYS[3]',
            'local reservationToken = ARGV[1]',
            'local rawJob = redis.call("HGET", processingItems, reservationToken)',
            'if rawJob then',
            '  redis.call("LREM", processingQueue, 1, rawJob)',
            'end',
            'local existed = redis.call("HEXISTS", processingItems, reservationToken)',
            'redis.call("HDEL", processingItems, reservationToken)',
            'redis.call("ZREM", visibility, reservationToken)',
            'return existed'
          ].join('\n'),
          {
            keys: [
              this.processingQueueKey(queueName),
              this.processingItemsKey(queueName),
              this.visibilityKey(queueName)
            ],
            arguments: [reservationToken]
          }
        );

        return Number(removed) === 1;
      },
      { label: `redis.queue.ack:${queueName}` }
    );
  }

  async requeueExpired(queueName, limit = this.requeueBatchSize) {
    return this.circuitBreaker.execute(
      async () => {
        const safeLimit = Math.max(1, Number(limit) || this.requeueBatchSize);
        const moved = await this.redisClient.eval(
          [
            'local pending = KEYS[1]',
            'local processingQueue = KEYS[2]',
            'local processingItems = KEYS[3]',
            'local visibility = KEYS[4]',
            'local now = tonumber(ARGV[1])',
            'local limit = tonumber(ARGV[2])',
            'local tokens = redis.call("ZRANGEBYSCORE", visibility, "-inf", now, "LIMIT", 0, limit)',
            'local moved = 0',
            'for _, token in ipairs(tokens) do',
            '  local rawJob = redis.call("HGET", processingItems, token)',
            '  if rawJob then',
            '    redis.call("LREM", processingQueue, 1, rawJob)',
            '    redis.call("RPUSH", pending, rawJob)',
            '    moved = moved + 1',
            '  end',
            '  redis.call("HDEL", processingItems, token)',
            '  redis.call("ZREM", visibility, token)',
            'end',
            'return moved'
          ].join('\n'),
          {
            keys: [
              queueName,
              this.processingQueueKey(queueName),
              this.processingItemsKey(queueName),
              this.visibilityKey(queueName)
            ],
            arguments: [String(Date.now()), String(safeLimit)]
          }
        );

        return Number(moved);
      },
      { label: `redis.queue.requeueExpired:${queueName}` }
    );
  }
}

module.exports = { QueueClient };
