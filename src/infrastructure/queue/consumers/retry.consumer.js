'use strict';

const { setTimeout: sleep } = require('timers/promises');
const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');

class RetryConsumer {
  constructor({ queueClient, warningRepository, pubSubService, logger }) {
    this.queueClient = queueClient;
    this.warningRepository = warningRepository;
    this.pubSubService = pubSubService;
    this.logger = logger;
    this.isRunning = false;
    this.pollIntervalMs = 1000;
  }

  async start() {
    this.isRunning = true;

    while (this.isRunning) {
      const pending = await this.warningRepository.getPendingOutboxEvents(25);
      if (pending.length === 0) {
        await sleep(this.pollIntervalMs);
        continue;
      }

      for (const event of pending) {
        try {
          await this.pubSubService.publish(event.destination || REDIS_CHANNELS.cacheInvalidate, event.eventType, event.payload, {
            correlationId: event.correlationId || null,
            causationId: event.causationId || event.correlationId || null
          });
          await this.warningRepository.markOutboxPublished(event.eventId);
        } catch (error) {
          this.logger?.warn?.('Outbox retry publish failed', {
            eventId: event.eventId,
            correlationId: event.correlationId || null,
            causationId: event.causationId || null,
            error: error.message
          });
        }
      }
    }
  }
}

module.exports = { RetryConsumer };
