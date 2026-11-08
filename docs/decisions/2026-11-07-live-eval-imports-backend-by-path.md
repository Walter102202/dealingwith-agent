# Live eval imports the backend by relative path and simulates the first payment

## Context

The live eval (Task B3) must run the real agent (`createAgentPort`) against a fresh seed of the demo data, which live in `apps/backend/src`. The backend package has no `exports` map and is not meant to be consumed as a library. Demo request 4 ("Send the Monday summary to our regional managers too") is only correct when clause C4, the paid additional of request 1, is already in the project scope; the capture workflow that appends it belongs to Track A and is not on `main`.

## Decision

- `evals/live/run.ts` imports backend modules by relative path (`../../apps/backend/src/...`), the same way Task A8's scenario tests do, and `evals/package.json` declares the third-party packages the runner itself imports (`drizzle-orm`) so `pnpm typecheck` resolves them from the evals workspace.
- Before requests 2 to 5 the runner appends clause C4 to the project with the same shape `appendPaidClauses` writes (`included: true`, `source: { kind: 'quote', quoteId, version }`), so the agent is graded on the scope a paying client would have. Request 1 runs against the contract scope alone.
- Grading is classification only: included clause ids, cited rule ids without version, and whether the agent asked. Wording, delivery days and confidence are not graded; amounts do not exist in the output.

## Alternatives considered

- **Consume `@dealingwith/backend` as a workspace dependency.** Needs an `exports` map and a build before every eval run; the backend is an application, not a library.
- **Run request 4 against the contract scope.** The right answer would then be "extra, rule S2.report", which contradicts the demo script; the eval would grade the wrong thing.
- **Grade the explanation text with a model.** Costs a second call per request and judges style; the product's correctness is in the classification.

## Consequences

- When Track A lands, the runner can call the real `markPaid` flow instead of the direct update; the expected results do not change.
- Adding a sixth demo request means one fixture, one case and nothing else.
