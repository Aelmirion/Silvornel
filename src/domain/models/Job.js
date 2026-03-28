'use strict';

class Job {
  constructor({ jobId, type, payload, attempt, maxAttempts, runAt, schemaVersion }) {
    this.jobId = jobId;
    this.type = type;
    this.payload = payload;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.runAt = runAt;
    this.schemaVersion = schemaVersion;
  }
}

module.exports = { Job };
