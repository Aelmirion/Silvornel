'use strict';

const { randomUUID } = require('crypto');

class QueueClient {
  constructor({ redisClient, circuitBreaker }) {
    this.redisClient = redisClient;
    this.circuitBreaker = circuitBreaker;
    this.defaultVisibilityTimeoutMs = 30_000;
    this.requeueBatchSize = 25;
  }

  async enqueue(queueName, job) {
    return this.circuitBreaker.execute(
      async () => this.redisClient.rPush(queueName, JSON.stringify(job)),
      { label: `redis.queue.enqueue:${queueName}` }
    );
  }

  async length(queueName) {
    return this.circuitBreaker.execute(
      async () => this.redisClient.lLen(queueName),
      { label: `redis.queue.length:${queueName}` }
    );
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

  async reserve(queueName, options = {}) {
    const blockTimeoutSeconds = Number.isInteger(options.blockTimeoutSeconds) ? options.blockTimeoutSeconds : 1;
    const visibilityTimeoutMs = Number.isInteger(options.visibilityTimeoutMs)
      ? options.visibilityTimeoutMs
      : this.defaultVisibilityTimeoutMs;

    return this.circuitBreaker.execute(
      async () => {
        await this.requeue(queueName);

        const rawJob = await this.redisClient.blMove(
          queueName,
          this.processingQueueKey(queueName),
          'LEFT',
          'RIGHT',
          blockTimeoutSeconds
        );

        if (!rawJob) {
          return null;
        }

        const reservationToken = randomUUID();
        const visibilityDeadline = Date.now() + Math.max(1_000, visibilityTimeoutMs);

        await this.redisClient.multi()
          .hSet(this.processingItemsKey(queueName), reservationToken, rawJob)
          .zAdd(this.visibilityKey(queueName), {
            score: visibilityDeadline,
            value: reservationToken
          })
          .exec();

        return {
          reservationToken,
          rawJob
        };
      },
      { label: `redis.queue.reserve:${queueName}` }
    );
  }

  async ack(queueName, reservationToken) {
    if (!reservationToken) {
      return false;
    }

    return this.circuitBreaker.execute(
      async () => {
        const rawJob = await this.redisClient.hGet(this.processingItemsKey(queueName), reservationToken);

        if (!rawJob) {
          return false;
        }

        const [, , removedFromProcessing] = await this.redisClient.multi()
          .zRem(this.visibilityKey(queueName), reservationToken)
          .hDel(this.processingItemsKey(queueName), reservationToken)
          .lRem(this.processingQueueKey(queueName), 1, rawJob)
          .exec();

        return Number(removedFromProcessing) > 0;
      },
      { label: `redis.queue.ack:${queueName}` }
    );
  }

  async requeue(queueName, reservationToken = null, job = null) {
    return this.circuitBreaker.execute(
      async () => {
        if (reservationToken) {
          const rawJob = await this.redisClient.hGet(this.processingItemsKey(queueName), reservationToken);
          if (!rawJob) {
            return 0;
          }

          const payload = job ? JSON.stringify(job) : rawJob;

          await this.redisClient.multi()
            .zRem(this.visibilityKey(queueName), reservationToken)
            .hDel(this.processingItemsKey(queueName), reservationToken)
            .lRem(this.processingQueueKey(queueName), 1, rawJob)
            .rPush(queueName, payload)
            .exec();
          return 1;
        }

        const now = Date.now();
        const expiredTokens = await this.redisClient.zRangeByScore(
          this.visibilityKey(queueName),
          0,
          now,
          { LIMIT: { offset: 0, count: this.requeueBatchSize } }
        );

        if (!expiredTokens.length) {
          return 0;
        }

        let moved = 0;
        for (const token of expiredTokens) {
          const rawJob = await this.redisClient.hGet(this.processingItemsKey(queueName), token);
          if (!rawJob) {
            await this.redisClient.zRem(this.visibilityKey(queueName), token);
            continue;
          }

          const [, , removed] = await this.redisClient.multi()
            .zRem(this.visibilityKey(queueName), token)
            .hDel(this.processingItemsKey(queueName), token)
            .lRem(this.processingQueueKey(queueName), 1, rawJob)
            .rPush(queueName, rawJob)
            .exec();

          if (Number(removed) > 0) {
            moved += 1;
          }
        }

        return moved;
      },
      { label: `redis.queue.requeue:${queueName}` }
    );
  }
}

module.exports = { QueueClient };
