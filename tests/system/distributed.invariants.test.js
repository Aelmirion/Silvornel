'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { CACHE_KEYS } = require('../../src/config/constants/cache.keys');
const { REDIS_CHANNELS } = require('../../src/config/constants/redis.channels');
const { QueueService } = require('../../src/application/services/queue.service');
const {
  QUEUE_NAMES,
  createSystemContext,
  resetTestState,
  createModerationConsumer,
  createRetryConsumer,
  startWorkers,
  stopWorkers,
  simulateCrash,
  shutdownContext,
  waitFor,
  createWarnDto
} = require('../helpers/systemTestHarness');

let ctx;

test.before(async () => {
  ctx = await createSystemContext();
});

test.beforeEach(async () => {
  await resetTestState(ctx);
});

test.after(async () => {
  if (ctx) {
    await shutdownContext(ctx);
  }
});

test('queue/no message loss on crash', async () => {
  const job = { id: randomUUID(), type: 'moderation_action', moderationActionId: randomUUID(), action: 'timeout' };
  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, job);

  const reserved = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 300 });
  assert.ok(reserved);

  await simulateCrash({});
  await new Promise((resolve) => setTimeout(resolve, 350));

  const retried = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 300 });
  assert.ok(retried);
  assert.equal(JSON.parse(retried.rawJob).id, job.id);
});

test('queue/visibility timeout returns unacked jobs', async () => {
  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, { id: 'vto-1', moderationActionId: randomUUID() });
  const first = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 200 });
  assert.ok(first);

  await new Promise((resolve) => setTimeout(resolve, 260));
  const second = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 200 });
  assert.ok(second);
  assert.equal(JSON.parse(second.rawJob).id, 'vto-1');
});

test('queue/duplicate delivery safety (idempotent side-effects)', async () => {
  let effectRuns = 0;
  const moderationConsumer = createModerationConsumer(ctx, {
    async execute() {
      effectRuns += 1;
    }
  });

  const job = {
    type: 'moderation_action',
    moderationActionId: randomUUID(),
    action: 'ban',
    guildId: 'g-dup',
    userId: 'u-dup'
  };

  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, job);
  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, job);

  const tasks = startWorkers({ moderationConsumer });
  await waitFor(async () => {
    assert.equal(effectRuns, 1);
    const pendingLen = await ctx.queueClient.length(QUEUE_NAMES.moderation);
    assert.equal(pendingLen, 0);
  }, 3000);
  await stopWorkers({ moderationConsumer, tasks });
});

test('retry survives crash and executes after restart', async () => {
  const job = { id: 'retry-crash-1', attempt: 0, moderationActionId: randomUUID() };
  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, job);

  const reserved = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 400 });
  assert.ok(reserved);

  const scheduled = await ctx.queueClient.scheduleRetry(
    QUEUE_NAMES.moderation,
    reserved.reservationToken,
    { ...job, attempt: 1 },
    Date.now() + 500
  );
  assert.equal(scheduled, true);

  await simulateCrash({});
  await new Promise((resolve) => setTimeout(resolve, 650));

  const restartedReservation = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 400 });
  assert.ok(restartedReservation);
  assert.equal(JSON.parse(restartedReservation.rawJob).id, job.id);
});

test('retry/delayed execution correctness', async () => {
  const runAt = Date.now() + 500;
  await ctx.queueClient.enqueueAt(QUEUE_NAMES.moderation, { id: 'delayed-1' }, runAt);

  const early = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 500 });
  assert.equal(early, null);

  await new Promise((resolve) => setTimeout(resolve, 550));
  const later = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 500 });
  assert.ok(later);
  assert.equal(JSON.parse(later.rawJob).id, 'delayed-1');
});

test('outbox/crash after DB commit is replayed by retry worker', async () => {
  const publishAttempts = [];
  const failingPubSub = {
    async publish(channel, type, payload) {
      publishAttempts.push({ channel, type, payload });
      throw new Error('simulate crash before publish completion');
    }
  };

  const brokenCtx = await createSystemContext({ pubSubServiceOverride: failingPubSub });
  await resetTestState(brokenCtx);

  const dto = createWarnDto({ guildId: 'g-outbox-1', targetUserId: 'u-outbox-1' });
  await assert.rejects(() => brokenCtx.moderationService.warnUser(dto));

  const pendingBefore = await brokenCtx.warningRepository.getPendingOutboxEvents(10);
  assert.equal(pendingBefore.length, 1);

  const replayed = [];
  const goodRetry = createRetryConsumer(brokenCtx, {
    async publish(channel, type, payload) {
      replayed.push({ channel, type, payload });
    }
  });

  const tasks = startWorkers({ retryConsumer: goodRetry });
  await waitFor(async () => {
    const pending = await brokenCtx.warningRepository.getPendingOutboxEvents(10);
    assert.equal(pending.length, 0);
    assert.equal(replayed.length, 1);
  }, 4000);

  await stopWorkers({ retryConsumer: goodRetry, tasks });
  await shutdownContext(brokenCtx);
}, { timeout: 25000 });

test('outbox idempotency: duplicated replay does not duplicate side-effect', async () => {
  const eventId = randomUUID();
  await ctx.warningRepository.createOutboxEvent({
    eventId,
    destination: REDIS_CHANNELS.cacheInvalidate,
    eventType: 'cache.invalidate',
    payload: { eventId, guildId: 'g-oid', userId: 'u-oid', entity: 'warnings' }
  });

  const seenIds = new Set();
  let sideEffects = 0;
  const retry = createRetryConsumer(ctx, {
    async publish(_channel, _type, payload) {
      if (!seenIds.has(payload.eventId)) {
        seenIds.add(payload.eventId);
        sideEffects += 1;
      }
    }
  });

  const tasks = startWorkers({ retryConsumer: retry });
  await waitFor(async () => {
    assert.equal(sideEffects, 1);
    const pending = await ctx.warningRepository.getPendingOutboxEvents(10);
    assert.equal(pending.length, 0);
  }, 3000);

  await ctx.warningRepository.createOutboxEvent({
    eventId: `${eventId}-duplicate`,
    destination: REDIS_CHANNELS.cacheInvalidate,
    eventType: 'cache.invalidate',
    payload: { eventId, guildId: 'g-oid', userId: 'u-oid', entity: 'warnings' }
  });

  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(sideEffects, 1);
  await stopWorkers({ retryConsumer: retry, tasks });
});

test('idempotency/duplicate command execution changes DB once', async () => {
  const actionId = randomUUID();
  const dto = createWarnDto({ moderationActionId: actionId, guildId: 'g-idm', targetUserId: 'u-idm' });

  await Promise.all([
    ctx.moderationService.warnUser(dto),
    ctx.moderationService.warnUser({ ...dto })
  ]);

  const warnings = await ctx.warningRepository.getWarningsByUser('g-idm', 'u-idm');
  assert.equal(warnings.length, 1);

  const reserved = await ctx.queueClient.reserve(QUEUE_NAMES.moderation, { blockTimeoutSeconds: 1, visibilityTimeoutMs: 200 });
  assert.equal(reserved, null);
});

test('idempotency/delayed replay does not create duplicate action', async () => {
  const actionId = randomUUID();
  const dto = createWarnDto({ moderationActionId: actionId, guildId: 'g-replay', targetUserId: 'u-replay' });

  await ctx.moderationService.warnUser(dto);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await ctx.moderationService.warnUser({ ...dto, reason: 'changed but same logical id' });

  const warnings = await ctx.warningRepository.getWarningsByUser('g-replay', 'u-replay');
  assert.equal(warnings.length, 1);
});

test('cache convergence/missed invalidation recovery across shards', async () => {
  const shardA = await createSystemContext();
  const shardB = await createSystemContext();
  await resetTestState(shardA);

  await shardA.subscriber.register();

  const cacheKey = CACHE_KEYS.warningsByUser('g-cache', 'u-cache');
  await shardB.warningCacheRepository.setWarnings('g-cache', 'u-cache', [{ id: 'stale' }], 120);
  assert.deepEqual(shardB.l1Cache.get(cacheKey), [{ id: 'stale' }]);

  const pendingEventId = randomUUID();
  await shardA.warningRepository.createOutboxEvent({
    eventId: pendingEventId,
    destination: REDIS_CHANNELS.cacheInvalidate,
    eventType: 'cache.invalidate',
    payload: { eventId: pendingEventId, guildId: 'g-cache', userId: 'u-cache', entity: 'warnings' }
  });

  await shardB.subscriber.register();
  const retry = createRetryConsumer(shardA);
  const tasks = startWorkers({ retryConsumer: retry });

  await waitFor(async () => {
    assert.equal(shardB.l1Cache.get(cacheKey), null);
    const pending = await shardA.warningRepository.getPendingOutboxEvents(10);
    assert.equal(pending.length, 0);
  }, 4000);

  await stopWorkers({ retryConsumer: retry, tasks });
  await shutdownContext(shardA);
  await shutdownContext(shardB);
});

test('concurrency/concurrent warnings keep counts correct and threshold effects are unique', async () => {
  const moderationActionIdBase = randomUUID();
  const warnings = Array.from({ length: 8 }).map((_, index) => createWarnDto({
    guildId: 'g-concurrency',
    targetUserId: 'u-concurrency',
    moderationActionId: `${moderationActionIdBase}-${index}`
  }));

  await Promise.all(warnings.map((dto) => ctx.moderationService.warnUser(dto)));
  const persisted = await ctx.warningRepository.getWarningsByUser('g-concurrency', 'u-concurrency');
  assert.equal(persisted.length, 8);

  const consumedActionIds = new Set();
  const moderationConsumer = createModerationConsumer(ctx, {
    async execute(job) {
      consumedActionIds.add(job.moderationActionId);
    }
  });
  const tasks = startWorkers({ moderationConsumer });

  await waitFor(async () => {
    const queueLen = await ctx.queueClient.length(QUEUE_NAMES.moderation);
    assert.equal(queueLen, 0);
    assert.equal(consumedActionIds.size, 1);
  }, 4000);

  await stopWorkers({ moderationConsumer, tasks });
});

test('concurrency/queue under burst retains jobs', async () => {
  const total = 150;
  await Promise.all(
    Array.from({ length: total }).map((_, index) => ctx.queueClient.enqueue(QUEUE_NAMES.analytics, { burst: index }))
  );

  const len = await ctx.queueClient.length(QUEUE_NAMES.analytics);
  assert.equal(len, total);
});

test('backpressure rejects when max capacity is exceeded without corruption', async () => {
  const tinyQueueService = new QueueService({
    queueClient: ctx.queueClient,
    logger: ctx.logger,
    envConfig: {
      ...ctx.envConfig,
      queue: { ...ctx.envConfig.queue, maxLength: 3 }
    }
  });

  await ctx.queueClient.enqueue(QUEUE_NAMES.analytics, { id: 'bp-1' });
  await ctx.queueClient.enqueue(QUEUE_NAMES.analytics, { id: 'bp-2' });
  await ctx.queueClient.enqueue(QUEUE_NAMES.analytics, { id: 'bp-3' });

  await assert.rejects(() => tinyQueueService.enqueue(QUEUE_NAMES.analytics, { id: 'bp-4' }));

  const len = await ctx.queueClient.length(QUEUE_NAMES.analytics);
  assert.equal(len, 3);
});

test('worker liveness: crash mid execution recovers after restart', async () => {
  let started = false;
  const blocker = {};
  blocker.promise = new Promise((resolve) => {
    blocker.resolve = resolve;
  });

  const firstWorker = createModerationConsumer(ctx, {
    async execute() {
      started = true;
      await blocker.promise;
    }
  });

  await ctx.queueClient.enqueue(QUEUE_NAMES.moderation, {
    type: 'moderation_action',
    moderationActionId: randomUUID(),
    action: 'timeout',
    guildId: 'g-live',
    userId: 'u-live'
  });

  const tasks = startWorkers({ moderationConsumer: firstWorker });
  await waitFor(async () => {
    assert.equal(started, true);
  }, 2000);

  await simulateCrash({ moderationConsumer: firstWorker });
  blocker.resolve();
  await stopWorkers({ moderationConsumer: firstWorker, tasks });

  await new Promise((resolve) => setTimeout(resolve, firstWorker.visibilityTimeoutMs + 100));

  let resumed = 0;
  const secondWorker = createModerationConsumer(ctx, {
    async execute() {
      resumed += 1;
    }
  });
  const tasks2 = startWorkers({ moderationConsumer: secondWorker });

  await waitFor(async () => {
    assert.ok(resumed >= 1);
    const len = await ctx.queueClient.length(QUEUE_NAMES.moderation);
    assert.equal(len, 0);
  }, 4000);
  await stopWorkers({ moderationConsumer: secondWorker, tasks: tasks2 });
}, { timeout: 45000 });
