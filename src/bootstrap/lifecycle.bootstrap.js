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
  }

  setState(nextState) {
    this.state = nextState;
  }

  getHealth() {
    return { live: true, state: this.state };
  }

  getReadiness() {
    return { ready: this.state === LifecycleState.READY, state: this.state };
  }

  async onShutdown() {
    this.setState(LifecycleState.SHUTTING_DOWN);
  }
}

module.exports = { LifecycleBootstrap, LifecycleState };
