'use strict';

const { setTimeout: sleep } = require('timers/promises');
const { QUEUE_NAMES } = require('../../../config/constants/queue.names');
const { computeBackoffMs } = require('../../../core/utils/backoff');
const { withTimeout } = require('../../../core/utils/timeout');

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
