'use strict';

class InteractionOrchestrator {
  constructor({ middlewarePipeline, controllerRegistry }) {
    this.middlewarePipeline = middlewarePipeline;
    this.controllerRegistry = controllerRegistry;
  }

  async handle(interactionContext) {
    return this.middlewarePipeline.run(interactionContext, async (ctx) => {
      const controller = this.controllerRegistry.resolve(ctx);
      return controller.execute(ctx);
    });
  }
}

module.exports = { InteractionOrchestrator };
