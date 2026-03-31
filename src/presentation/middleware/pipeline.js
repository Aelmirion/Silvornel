'use strict';

class MiddlewarePipeline {
  constructor({ middlewares = [], logger = null, metrics = null }) {
    this.middlewares = middlewares;
    this.logger = logger;
    this.metrics = metrics;
  }

  async run(context, terminalHandler) {
    const invoke = async (index, ctx) => {
      if (index >= this.middlewares.length) {
        return terminalHandler(ctx);
      }

      const middleware = this.middlewares[index];
      const middlewareName = middleware.name || `middleware_${index}`;
      const correlationId = ctx?.correlationId || ctx?.id || null;
      const start = Date.now();

      this.logger?.debug?.('Middleware execution started', {
        correlationId,
        middleware: middlewareName,
        commandName: ctx?.commandName || null
      });

      this.metrics?.increment?.('middleware.execution.total', {
        middleware: middlewareName,
        stage: 'start'
      });

      try {
        const result = await middleware(ctx, (nextCtx = ctx) => invoke(index + 1, nextCtx));
        const durationMs = Date.now() - start;

        this.metrics?.increment?.('middleware.execution.total', {
          middleware: middlewareName,
          stage: 'success'
        });
        this.metrics?.timing?.('middleware.execution.duration.ms', durationMs, {
          middleware: middlewareName
        });

        this.logger?.debug?.('Middleware execution completed', {
          correlationId,
          middleware: middlewareName,
          durationMs
        });

        return result;
      } catch (error) {
        const durationMs = Date.now() - start;

        this.metrics?.increment?.('middleware.execution.total', {
          middleware: middlewareName,
          stage: 'error'
        });
        this.metrics?.timing?.('middleware.execution.duration.ms', durationMs, {
          middleware: middlewareName,
          stage: 'error'
        });

        this.logger?.warn?.('Middleware execution failed', {
          correlationId,
          middleware: middlewareName,
          durationMs,
          error: error.message
        });

        throw error;
      }
    };

    return invoke(0, context);
  }
}

module.exports = { MiddlewarePipeline };
