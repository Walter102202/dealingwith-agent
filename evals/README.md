# Evals

Live model eval for the DealingWith Agent. It runs the five demo requests of the spec (section 6) against the configured provider, on a fresh in-memory copy of the demo data, and grades **classification only**: which clauses the agent marked as included, which pricing rules it cited, and whether it asked a question. Amounts are never graded because the model never produces them; the pricing engine does.

## Run

```bash
pnpm eval:live                       # provider from .env (LLM_PROVIDER), mock by default
LLM_PROVIDER=anthropic pnpm eval:live   # needs ANTHROPIC_API_KEY in .env
LLM_PROVIDER=openai pnpm eval:live      # needs OPENAI_API_KEY in .env
```

One line per request: `PASS`/`FAIL`, the fixture id, latency, tokens, and the refs the agent cited (with `missing=` and `extra=` on a failure). The process exits 1 when any request fails. It is not part of CI.

## Layout

- `scenarios/fixtures/*.json`: the five expected outputs, one per demo request (`{ match, output }`). They mirror `apps/backend/src/agent/mock-fixtures.ts`, which the mock provider answers from; a backend test keeps the two identical.
- `graders/classification.ts`: `gradeClassification(output, expected)` → `{ pass, missing, extra }`.
- `live/cases.ts`: the five requests with their expected classification. Request 4 needs the paid additional C4 in scope, so the runner appends it after request 1, as a payment would.
- `live/run.ts`: the runner.

`pnpm test` from the repo root runs the grader tests (`graders/*.test.ts`); they use the fixtures and need no key.
