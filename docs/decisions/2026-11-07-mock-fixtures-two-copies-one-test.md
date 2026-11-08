# Mock fixtures: TypeScript is the source, the JSON files are a tested mirror

## Context

The mock provider (Task B2) answers the five demo requests from fixed outputs. The plan wants them twice: as `apps/backend/src/agent/mock-fixtures.ts` for the backend and as `evals/scenarios/fixtures/*.json` for the live eval and for judges who read the repository. The backend build has `rootDir: "src"`, so backend code cannot import files under `evals/`, and a workspace package should not reach into another package's `src/` at runtime.

## Decision

`mock-fixtures.ts` is the single source of truth. The five JSON files are a mirror, and `mock-fixtures.test.ts` reads them from disk and asserts deep equality with the TypeScript array, so the two copies cannot drift without a red test. Regenerating the JSON is a one-line script run by hand when a fixture changes.

## Alternatives considered

- **Backend reads the JSON at runtime.** Crosses package boundaries, needs a copy step into `dist/`, and makes the backend depend on the evals workspace.
- **Evals import the TypeScript.** Works in development through the `development` export condition, but ties the eval package to backend internals and leaves no plain-data artifact for readers.

## Consequences

- Track A's `demo-agent-outputs.ts` becomes a re-export of `MOCK_FIXTURES` at merge, as the plan already states.
- Editing a fixture means editing the TypeScript and regenerating the JSON; the test tells you when you forgot.
