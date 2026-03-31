# Distributed Systems Invariant Test Suite

This suite validates system-level invariants using **real Redis** and **real MariaDB**.

## What is covered

- queue delivery durability (crash + visibility timeout + duplicate delivery)
- retry durability and delayed execution timing
- outbox replay durability and idempotency expectations
- moderation command idempotency
- cross-shard cache convergence after missed invalidation
- concurrent warning handling
- burst load and queue backpressure behavior
- worker liveness and job recovery

## Required test infrastructure

Set these environment variables for test instances:

- `TEST_MARIADB_HOST` (default `127.0.0.1`)
- `TEST_MARIADB_PORT` (default `3306`)
- `TEST_MARIADB_USER` (default `root`)
- `TEST_MARIADB_PASSWORD` (default empty)
- `TEST_MARIADB_DATABASE` (default `silvornel_test`)
- `TEST_REDIS_URL` (default local mode: `redis://127.0.0.1:6379/15`, CI mode: `redis://redis:6379/15`)
- `TEST_REDIS_KEY_PREFIX` (default `test:`)

Optional tuning:

- `TEST_QUEUE_MAX_ATTEMPTS`
- `TEST_QUEUE_RETRY_BASE_MS`
- `TEST_QUEUE_VISIBILITY_TIMEOUT_MS`
- `TEST_QUEUE_SCHEDULER_INTERVAL_MS`
- `TEST_EXTERNAL_CALL_TIMEOUT_MS`

## Isolation guarantees

- Redis keys are namespaced under `test:` and run in a dedicated Redis DB index (`/15` by default).
- MariaDB uses a dedicated test database (`silvornel_test` by default).
- Every test resets Redis keys by prefix and truncates relevant MariaDB tables.

## Run modes

### Local mode

Assumes Redis and MariaDB are running locally.

```bash
npm install
npm run test:system:local
```

### CI mode

Assumes ephemeral containers where Redis and MariaDB are started per run.

```bash
npm run test:system:ci
```

## Helper utilities included

Utilities are implemented in `tests/helpers/systemTestHarness.js`:

- `resetTestState()` truncates MariaDB tables and clears Redis keys under `test:*`.
- `simulateCrash()` forces worker loop stop without graceful completion.
- `startWorkers()` starts moderation/retry worker loops.
- `stopWorkers()` performs controlled worker shutdown for tests.
