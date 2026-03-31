'use strict';

const { setTimeout: sleep } = require('timers/promises');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');
const { computeBackoffMs } = require('../../../core/utils/backoff');
const { withTimeout } = require('../../../core/utils/timeout');
const { createIdempotencyKey } = require('../../../core/utils/idempotency');

const MODERATION_DEAD_LETTER_QUEUE = `${QUEUE_NAMES.moderation}:dead-letter`;

class ModerationConsumer {
  constructor({ queueClient, envConfig, moderationActionService, logger }) {
    this.queueClient = queueClient;
    this.envConfig = envConfig;
    this.moderationActionService = moderationActionService;
    this.logger = logger;
    this.timeoutMs = envConfig?.runtime?.externalCallTimeoutMs ?? 2000;
    this.lockTtlSeconds = Math.max(30, Math.ceil(this.timeoutMs / 1000) + 30);
    this.completedTtlSeconds = 86_400;
    this.pollTimeoutSeconds = 1;
    this.visibilityTimeoutMs = Math.max(this.timeoutMs + 10_000, 30_000);
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;

    while (this.isRunning) {
      const reserved = await this.receiveJob();
      if (!reserved) {
        continue;
      }

      if (reserved.job.type !== 'moderation_action') {
        await this.queueClient.ack(QUEUE_NAMES.moderation, reserved.reservationToken);
        continue;
      }

      await this.processJob(reserved);
    }
  }

  async receiveJob() {
    const reserved = await this.queueClient.reserve(QUEUE_NAMES.moderation, {
      blockTimeoutSeconds: this.pollTimeoutSeconds,
      visibilityTimeoutMs: this.visibilityTimeoutMs
    });

    if (!reserved || !reserved.rawJob) {
      return null;
    }

    try {
      const job = JSON.parse(reserved.rawJob);
      this.logger?.debug?.('Queue job reserved', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
      return {
        ...reserved,
        job
      };
    } catch (error) {
      this.logger?.error?.('Queue job parsing failed', {
        correlationId: null,
        userId: null,
        guildId: null,
        queueName: QUEUE_NAMES.moderation,
        error: error.message
      });
      await this.queueClient.enqueue(MODERATION_DEAD_LETTER_QUEUE, {
        type: 'invalid_job',
        payload: reserved.rawJob,
        failedAt: Date.now(),
        error: error.message
      });
      await this.queueClient.ack(QUEUE_NAMES.moderation, reserved.reservationToken);
      return null;
    }
  }

  async processJob({ reservationToken, job }) {
    this.logger?.info?.('Queue job processing started', {
      correlationId: job.correlationId || job.traceId || null,
      causationId: job.causationId || null,
      userId: job.userId || null,
      guildId: job.guildId || null,
      queueName: QUEUE_NAMES.moderation,
      action: job.action || null,
      attempt: job.attempt || 0
    });

    const idempotencyId = job.moderationActionId || job.traceId || job.jobId || `${job.guildId}:${job.userId}:${job.action}`;
    const idempotencyBaseKey = createIdempotencyKey('v1:idem:moderation_action', idempotencyId);
    const completedKey = `${idempotencyBaseKey}:done`;
    const lockKey = `${idempotencyBaseKey}:lock`;

    const alreadyCompleted = await this.queueClient.redisClient.get(completedKey);
    if (alreadyCompleted) {
      this.logger?.debug?.('Queue job skipped (already completed)', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
      await this.queueClient.ack(QUEUE_NAMES.moderation, reservationToken);
      return;
    }

    const acquired = await this.queueClient.redisClient.set(lockKey, '1', {
      NX: true,
      EX: this.lockTtlSeconds
    });

    if (!acquired) {
      this.logger?.debug?.('Queue job skipped (lock not acquired)', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
      return;
    }

    try {
      await withTimeout(
        () => this.executeAction(job),
        this.timeoutMs,
        `moderation:${job.action || 'unknown'}`
      );

      await this.queueClient.redisClient.multi()
        .set(completedKey, '1', { EX: this.completedTtlSeconds })
        .del(lockKey)
        .exec();
      await this.queueClient.ack(QUEUE_NAMES.moderation, reservationToken);
      this.logger?.info?.('Queue job processing completed', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
    } catch (error) {
      await this.queueClient.redisClient.del(lockKey);
      await this.handleFailure(job, reservationToken, error);
    }
  }

  async executeAction(job) {
    if (this.moderationActionService?.execute) {
      await this.moderationActionService.execute(job);
      return;
    }

    if (this.logger?.info) {
      this.logger.info('Moderation action executed (placeholder)', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        action: job.action,
        guildId: job.guildId,
        userId: job.userId,
        traceId: job.traceId || null
      });
      return;
    }

    // eslint-disable-next-line no-console
    console.info('[queue:moderation] action executed (placeholder)', {
      action: job.action,
      guildId: job.guildId,
      userId: job.userId,
      traceId: job.traceId || null
    });
  }

  async handleFailure(job, reservationToken, error) {
    const attempt = Number.isInteger(job.attempt) ? job.attempt + 1 : 1;
    const maxAttempts = Number.isInteger(job.maxAttempts) ? job.maxAttempts : 3;
    const failureMeta = {
      correlationId: job.correlationId || job.traceId || null,
      causationId: job.causationId || null,
      userId: job.userId || null,
      guildId: job.guildId || null,
      queueName: QUEUE_NAMES.moderation,
      action: job.action || null,
      attempt,
      maxAttempts,
      error: error.message
    };

    if (attempt >= maxAttempts) {
      this.logger?.error?.('Queue job failed permanently', failureMeta);
      await this.queueClient.enqueue(MODERATION_DEAD_LETTER_QUEUE, {
        ...job,
        attempt,
        failedAt: Date.now(),
        error: error.message
      });
      await this.queueClient.ack(QUEUE_NAMES.moderation, reservationToken);
      return;
    }

    const backoffMs = computeBackoffMs(attempt, this.envConfig?.redis?.retryBaseMs ?? 100);
    this.logger?.warn?.('Queue job failed, retry scheduled', {
      ...failureMeta,
      backoffMs
    });
    await sleep(backoffMs);

    await this.queueClient.requeue(QUEUE_NAMES.moderation, reservationToken, {
      ...job,
      attempt,
      runAt: Date.now() + backoffMs,
      lastError: error.message
    });
  }
}

module.exports = { ModerationConsumer };
