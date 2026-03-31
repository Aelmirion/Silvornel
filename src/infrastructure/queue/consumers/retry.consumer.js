'use strict';

const { REDIS_CHANNELS } = require('../../../config/constants/redis.channels');

class RetryConsumer {
  constructor({ queueClient, warningRepository, pubSubService, logger }) {
    this.queueClient = queueClient;
    this.warningRepository = warningRepository;
    this.pubSubService = pubSubService;
    this.logger = logger;
  }

  async start() {
    const pending = await this.warningRepository.getPendingOutboxEvents(25);
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

module.exports = { RetryConsumer };
