# Silvornel Discord Bot

A production-oriented, shard-aware Discord bot codebase built with strict boundaries, dependency injection, and clear runtime safety controls.

## Overview

Silvornel is structured to support high-scale command handling across shards while keeping domain logic isolated from framework and infrastructure concerns.

Core technologies:

- Node.js (CommonJS)
- `discord.js`
- MariaDB (raw SQL repositories)
- Redis (cache, pub/sub, queue, rate limiting)

## Architecture

The project follows a strict layered design:

- **Presentation**: DTO parsing, middleware pipeline, controllers
- **Application**: use-case services and orchestrators
- **Domain**: models, contracts, business rules
- **Infrastructure**: repository and cache/pubsub implementations
- **Adapters**: integrations for Discord, Redis, and MariaDB

Dependency resolution is centralized in `src/container` using token-based bindings.

## Sharding Model

- `index.js` is dedicated to launching `ShardingManager`
- `bot.js` runs shard worker bootstrapping
- Each shard initializes container wiring, clients, subscribers, and routers

## Profile Feature (Implemented Vertical Slice)

The `/profile` feature includes:

- Read flow with cache-aside behavior
- Default profile creation when absent
- Update flow with DB-first write
- Cache invalidation and cross-shard invalidation event publishing
- DTO validation and domain-rule enforcement

## Caching Strategy

Two-level cache is used:

- **L1**: shard-local in-memory cache
- **L2**: Redis cache

Read behavior:

1. Check L1
2. Fallback to L2
3. Fallback to MariaDB
4. Backfill caches

Write behavior:

1. Persist to DB
2. Invalidate L2
3. Invalidate local L1
4. Publish invalidation event for other shards

## Runtime Safety

The runtime includes safety mechanisms:

- Timeout wrappers for external calls
- Circuit-breaker execution wrapper
- Redis reconnect retry with exponential backoff
- Startup validation for DI token bindings and controller registry completeness
- Queue backpressure guard via queue length checks

## Project Structure

```text
src/
  adapters/
  application/
  bootstrap/
  config/
  container/
  core/
  domain/
  infrastructure/
  presentation/
  workers/
```

## Local Commands

```bash
npm run check
npm start
npm run start:shard
```

## Notes

- SQL is intentionally confined to repository SQL adapter files.
- Service layer responses remain transport-agnostic (no Discord objects).
- Middleware pipeline is the mandatory entry path before controller execution.
