'use strict';

const LifecycleState = Object.freeze({
  BOOTING: 'BOOTING',
  CONNECTING: 'CONNECTING',
  READY: 'READY',
  DEGRADED: 'DEGRADED',
  NOT_READY: 'NOT_READY',
  SHUTTING_DOWN: 'SHUTTING_DOWN'
});

class LifecycleBootstrap {
  constructor({ logger }) {
    this.logger = logger;
    this.state = LifecycleState.BOOTING;
    this.workerHealth = new Map();
  }

  setState(nextState) {
    this.state = nextState;
  }

  reportWorkerHealth(workerName, isHealthy, reason = null) {
    this.workerHealth.set(workerName, {
      healthy: Boolean(isHealthy),
      reason,
      updatedAt: new Date().toISOString()
    });

    if (!isHealthy && this.state === LifecycleState.READY) {
      this.state = LifecycleState.DEGRADED;
      this.logger?.warn?.('Lifecycle degraded due to worker health', { workerName, reason });
    }
  }

  areWorkersHealthy() {
    if (this.workerHealth.size === 0) {
      return false;
    }

    for (const entry of this.workerHealth.values()) {
      if (!entry.healthy) {
        return false;
      }
    }

    return true;
  }

  getHealth() {
    return {
      live: true,
      state: this.state,
      workers: Object.fromEntries(this.workerHealth.entries())
    };
  }

  getReadiness() {
    const workersHealthy = this.areWorkersHealthy();
    const ready = this.state === LifecycleState.READY && workersHealthy;

    return {
      ready,
      state: ready ? LifecycleState.READY : LifecycleState.NOT_READY,
      workersHealthy,
      workers: Object.fromEntries(this.workerHealth.entries())
    };
  }

  async onShutdown() {
    this.setState(LifecycleState.SHUTTING_DOWN);
  }
}

module.exports = { LifecycleBootstrap, LifecycleState };
