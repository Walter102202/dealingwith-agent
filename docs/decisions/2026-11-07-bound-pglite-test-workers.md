# Bound backend PGlite test workers

## Context

As the backend suite grew, simultaneous PGlite startup pushed the unchanged seed test and the dashboard test past their five-second timeout. Both passed in focused runs; the full suite reproduced the timeout twice.

## Decision

Limit the backend Vitest project to two workers. Keep every test, assertion and timeout unchanged. Use a backend project configuration, leaving root configuration to the integrator.

## Alternatives considered

- Increase timeouts: masks contention and makes real hangs slower to diagnose.
- Remove database coverage: loses transaction and idempotency evidence.
- Change root configuration: outside this track's authority except the A8 workspace addition.

## Consequences

The suite uses fewer simultaneous embedded databases. It can take longer but is less sensitive to host core count. Existing db tests still need integrator-owned cleanup of unclosed instances.
