# Agent port placeholder inside src

## Context

Track A must boot independently of Track B. The integrator's 2026-11-07 addendum moves the agent under src so it is included in typecheck and the production rootDir.

## Decision

Provide apps/backend/src/agent/port.ts with createAgentPort(env), returning the deterministic fake port. The entry point imports ./agent/port.js. Track B replaces this one file when integrated.

## Alternatives considered

- Import Track B before integration: prevents independent development.
- Keep the old apps/backend/agent path: violates the build rootDir and skips normal typechecking.

## Consequences

The Track A server runs with mock fixtures and no model credentials. Real provider selection belongs to Track B. The fake fixture set intentionally contains only the five specified requests; arbitrary storefront text needs the real agent or a matching injected fixture.
