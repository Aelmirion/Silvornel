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
- `TEST_REDIS_URL` (default `redis://127.0.0.1:6379`)

Optional tuning:

- `TEST_QUEUE_MAX_ATTEMPTS`
- `TEST_QUEUE_RETRY_BASE_MS`
- `TEST_EXTERNAL_CALL_TIMEOUT_MS`

## Run

```bash
npm install
npm run test:system
```

## Helper utilities included

Utilities are implemented in `tests/helpers/systemTestHarness.js`:

- `resetTestState()` clears MariaDB tables and Redis keys.
- `simulateCrash()` forces worker loop stop without graceful completion.
- `startWorkers()` starts moderation/retry worker loops.
- `stopWorkers()` performs controlled worker shutdown for tests.
