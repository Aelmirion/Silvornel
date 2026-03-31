'use strict';

const { QUEUE_NAMES } = require('../../../config/constants/queue.names');
const { withTimeout } = require('../../../core/utils/timeout');
const { computeBackoffMs } = require('../../../core/utils/backoff');

const MODERATION_DEAD_LETTER_QUEUE = `${QUEUE_NAMES.moderation}:dead-letter`;
const CONSUMER_EFFECT_TYPE_PREFIX = 'consumer_execute';

class ModerationConsumer {
  constructor({ queueClient, envConfig, moderationActionService, warningRepository, logger }) {
    this.queueClient = queueClient;
    this.envConfig = envConfig;
    this.moderationActionService = moderationActionService;
    this.warningRepository = warningRepository;
    this.logger = logger;
    this.timeoutMs = envConfig?.runtime?.externalCallTimeoutMs ?? 2000;
    this.pollTimeoutSeconds = Math.max(1, envConfig?.queue?.pollTimeoutSeconds ?? 1);
    this.visibilityTimeoutMs = Math.max(
      100,
      envConfig?.queue?.visibilityTimeoutMs ?? Math.max(this.timeoutMs + 10_000, 30_000)
    );
    this.retryBaseMs = envConfig?.queue?.retryBaseMs ?? 1000;
    this.maxAttempts = Math.max(1, envConfig?.queue?.maxAttempts ?? 5);
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

    if (!job.moderationActionId) {
      this.logger?.error?.('Queue job rejected (missing moderationActionId)', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null
      });
      await this.queueClient.enqueue(MODERATION_DEAD_LETTER_QUEUE, {
        ...job,
        failedAt: Date.now(),
        error: 'missing moderationActionId'
      });
      await this.queueClient.ack(QUEUE_NAMES.moderation, reservationToken);
      return;
    }

    const effectType = `${CONSUMER_EFFECT_TYPE_PREFIX}:${job.action || 'unknown'}`;
    const accepted = await this.warningRepository.registerModerationEffectExecution({
      moderationActionId: job.moderationActionId,
      effectType,
      guildId: job.guildId || 'unknown',
      userId: job.userId || 'unknown',
      actionType: job.action || 'unknown',
      correlationId: job.correlationId || null,
      causationId: job.causationId || job.correlationId || null
    });
    if (!accepted) {
      this.logger?.debug?.('Queue job skipped (already executed)', {
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

    try {
      await withTimeout(
        () => this.executeAction(job),
        this.timeoutMs,
        `moderation:${job.action || 'unknown'}`
      );
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
      await this.warningRepository.unregisterModerationEffectExecution({
        moderationActionId: job.moderationActionId,
        effectType
      });
      await this.scheduleRetry({ reservationToken, job, error });
    }
  }

  async scheduleRetry({ reservationToken, job, error }) {
    const nextAttempt = (job.attempt || 0) + 1;

    if (nextAttempt >= this.maxAttempts) {
      await this.queueClient.enqueue(MODERATION_DEAD_LETTER_QUEUE, {
        ...job,
        attempt: nextAttempt,
        failedAt: Date.now(),
        error: error.message
      });
      await this.queueClient.ack(QUEUE_NAMES.moderation, reservationToken);
      this.logger?.error?.('Queue job exhausted retries and moved to dead letter queue', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null,
        attempt: nextAttempt,
        maxAttempts: this.maxAttempts,
        error: error.message
      });
      return;
    }

    const backoffMs = computeBackoffMs(nextAttempt, this.retryBaseMs);
    const nextRetryAt = Date.now() + backoffMs;
    const retryJob = {
      ...job,
      attempt: nextAttempt,
      lastError: error.message,
      nextRetryAt
    };

    const scheduled = await this.queueClient.scheduleRetry(
      QUEUE_NAMES.moderation,
      reservationToken,
      retryJob,
      nextRetryAt
    );

    if (!scheduled) {
      this.logger?.warn?.('Queue retry scheduling failed, falling back to visibility timeout', {
        correlationId: job.correlationId || job.traceId || null,
        causationId: job.causationId || null,
        userId: job.userId || null,
        guildId: job.guildId || null,
        queueName: QUEUE_NAMES.moderation,
        action: job.action || null,
        error: error.message,
        attempt: nextAttempt,
        visibilityTimeoutMs: this.visibilityTimeoutMs
      });
      return;
    }

    this.logger?.warn?.('Queue job failed and was scheduled for durable retry', {
      correlationId: job.correlationId || job.traceId || null,
      causationId: job.causationId || null,
      userId: job.userId || null,
      guildId: job.guildId || null,
      queueName: QUEUE_NAMES.moderation,
      action: job.action || null,
      error: error.message,
      attempt: nextAttempt,
      backoffMs,
      nextRetryAt
    });
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
}

module.exports = { ModerationConsumer };
