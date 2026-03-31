'use strict';

const { EVENT_SCHEMA } = require('../../config/constants/event.schema');

class PubSubService {
  constructor({ publisher, subscriber }) {
    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  toEnvelope(type, payload, meta = {}) {
    if (payload && typeof payload === 'object' && Number.isInteger(payload.version) && payload.type && payload.payload) {
      return payload;
    }

    return {
      version: EVENT_SCHEMA.current,
      type,
      payload,
      meta
    };
  }

  isSupportedVersion(version) {
    return EVENT_SCHEMA.supported.includes(version);
  }

  async publish(channel, typeOrPayload, payload = null, meta = {}) {
    const envelope = payload === null
      ? this.toEnvelope(typeOrPayload?.type || 'event.legacy', typeOrPayload, meta)
      : this.toEnvelope(typeOrPayload, payload, meta);
    return this.publisher.publish(channel, envelope);
  }

  async subscribe(channel, handler) {
    return this.subscriber.subscribe(channel, async (message) => {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      const envelope = payload?.payload ? payload : {
        version: 1,
        type: payload?.type || 'event.legacy',
        payload
      };

      if (!this.isSupportedVersion(envelope.version)) {
        return null;
      }

      return handler(envelope);
    });
  }
}

module.exports = { PubSubService };
