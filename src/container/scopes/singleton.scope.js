'use strict';

class Container {
  constructor() {
    this.bindings = new Map();
    this.singletons = new Map();
  }

  bind(token, factory, { singleton = true } = {}) {
    this.bindings.set(token, { factory, singleton });
  }

  has(token) {
    return this.bindings.has(token);
  }

  listBindings() {
    return Array.from(this.bindings.keys());
  }

  resolve(token) {
    const binding = this.bindings.get(token);
    if (!binding) throw new Error(`Missing binding for token: ${token}`);
    if (binding.singleton) {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, binding.factory(this));
      }
      return this.singletons.get(token);
    }
    return binding.factory(this);
  }
}

module.exports = { Container };
