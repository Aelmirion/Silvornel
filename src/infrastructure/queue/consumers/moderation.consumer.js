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
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;

    while (this.isRunning) {
      const job = await this.receiveJob();
      if (!job || job.type !== 'moderation_action') {
        continue;
      }

      await this.processJob(job);
    }
  }

  async receiveJob() {
    const result = await this.queueClient.redisClient.blPop(QUEUE_NAMES.moderation, this.pollTimeoutSeconds);

    if (!result || !result.element) {
      return null;
    }

    try {
      const job = JSON.parse(result.element);
      this.logger?.debug?.('Queue job reserved', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
      return job;
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
        payload: result.element,
        failedAt: Date.now(),
        error: error.message
      });
      return null;
    }
  }

  async processJob(job) {
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
      await this.handleFailure(job, error);
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

  async handleFailure(job, error) {
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
      return;
    }

    const backoffMs = computeBackoffMs(attempt, this.envConfig?.redis?.retryBaseMs ?? 100);
    this.logger?.warn?.('Queue job failed, retry scheduled', {
      ...failureMeta,
      backoffMs
    });
    await sleep(backoffMs);

    await this.queueClient.enqueue(QUEUE_NAMES.moderation, {
      ...job,
      attempt,
      runAt: Date.now() + backoffMs,
      lastError: error.message
    });
  }
}

module.exports = { ModerationConsumer };
