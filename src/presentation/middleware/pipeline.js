'use strict';

class MiddlewarePipeline {
  constructor({ middlewares = [] }) {
    this.middlewares = middlewares;
  }

  async run(context, terminalHandler) {
    const invoke = async (index, ctx) => {
      if (index >= this.middlewares.length) {
        return terminalHandler(ctx);
      }

      const middleware = this.middlewares[index];
      return middleware(ctx, (nextCtx = ctx) => invoke(index + 1, nextCtx));
    };

    return invoke(0, context);
  }
}

module.exports = { MiddlewarePipeline };
