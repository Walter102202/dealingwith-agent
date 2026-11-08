# Scenario workspace Node types

## Context

The scenario workspace inherits types: ["node"] from the shared TypeScript configuration and imports backend code using Node APIs. pnpm isolates each workspace's direct dependencies.

## Decision

Declare @types/node at the existing backend version range in the scenario workspace, alongside the planned contracts, Vitest and TypeScript dependencies. Keep TypeScript at ~5.9.3. Run scenarios with two workers in sequence group 2, after the backend group, to bound PGlite startup.

## Alternatives considered

- Point typeRoots at another workspace's node_modules: couples typechecking to its installation layout.
- Change shared compiler configuration: unnecessary and outside this task's scope.

## Consequences

Standalone scenario typechecking resolves Node types without hoisting assumptions. No runtime dependency is added. Only the tests entry is added to root workspace and Vitest lists; the integrator retains Track B's evals entry at merge.
