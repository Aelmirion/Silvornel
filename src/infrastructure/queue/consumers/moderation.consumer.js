'use strict';

const { setTimeout: sleep } = require('timers/promises');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');
const { computeBackoffMs } = require('../../../core/utils/backoff');
const { withTimeout } = require('../../../core/utils/timeout');
const { createIdempotencyKey } = require('../../../core/utils/idempotency');

const MODERATION_RETRY_QUEUE = `${QUEUE_NAMES.moderation}:retry`;
const MODERATION_DEAD_LETTER_QUEUE = `${QUEUE_NAMES.moderation}:dead-letter`;

class ModerationConsumer {
  constructor({ queueClient, envConfig, moderationActionService, logger }) {
    this.queueClient = queueClient;
    this.envConfig = envConfig;
    this.moderationActionService = moderationActionService;
    this.logger = logger;
    this.timeoutMs = envConfig?.runtime?.externalCallTimeoutMs ?? 2000;
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
      return JSON.parse(result.element);
    } catch (error) {
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
    const idempotencyId = job.traceId || job.jobId || `${job.guildId}:${job.userId}:${job.action}`;
    const idempotencyKey = createIdempotencyKey('v1:idem:moderation_action', idempotencyId);
    const acquired = await this.queueClient.redisClient.set(idempotencyKey, '1', { NX: true, EX: 86_400 });

    if (!acquired) {
      return;
    }

    try {
      await withTimeout(
        () => this.executeAction(job),
        this.timeoutMs,
        `moderation:${job.action || 'unknown'}`
      );
    } catch (error) {
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

    if (attempt >= maxAttempts) {
      await this.queueClient.enqueue(MODERATION_DEAD_LETTER_QUEUE, {
        ...job,
        attempt,
        failedAt: Date.now(),
        error: error.message
      });
      return;
    }

    const backoffMs = computeBackoffMs(attempt, this.envConfig?.redis?.retryBaseMs ?? 100);

    await this.queueClient.enqueue(MODERATION_RETRY_QUEUE, {
      ...job,
      attempt,
      runAt: Date.now() + backoffMs,
      lastError: error.message
    });

    await sleep(backoffMs);

    await this.queueClient.enqueue(QUEUE_NAMES.moderation, {
      ...job,
      attempt,
      runAt: Date.now() + backoffMs
    });
  }
}

module.exports = { ModerationConsumer };
