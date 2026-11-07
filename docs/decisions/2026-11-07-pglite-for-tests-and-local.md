# PGlite for tests and local default, `pg` for Render

## Context

Phase 1 runs several tracks in parallel git worktrees, each needing a database, and the test suite must run in CI with no services. Production runs on Render Postgres.

## Decision

Use `@electric-sql/pglite` (embedded PostgreSQL in WebAssembly) through Drizzle for tests (`pglite://memory`) and as the local default (`DATABASE_URL=pglite://.data/dev`). Use the `pg` driver when `DATABASE_URL` starts with `postgres://`. Both run the same Drizzle migrations from the same SQL files.

## Alternatives considered

- **Docker Postgres locally and in CI.** Real engine, but every worktree needs its own container and port, and CI gets slower and flakier.
- **SQLite for tests.** Different SQL dialect; `jsonb`, `timestamptz` and unique-violation semantics would diverge from production.
- **Mocking the repository layer.** Hides exactly the bugs this product cares about (idempotency, unique keys, row locks).

## Consequences

- `createDb(url)` picks the driver from the URL scheme; application code never knows which one is running.
- Tests are hermetic and parallel-safe: each test file creates its own in-memory database.
- PGlite's feature set is PostgreSQL's; anything that passes locally should pass on Render. Phase 2 confirms it against the real instance.
- `.data/` is git-ignored.
