# Agent run: one retry on schema failure, two stable error codes, a row for every run

## Context

The agent (Task B2) makes one structured call per request. A model can answer outside the schema (an amount field, an unknown key, invalid JSON), a provider call can fail, and the mock provider can meet a request it has no fixture for. The workflows need stable outcomes to map to HTTP statuses, and `agent_runs` must record what happened even when nothing usable came back. Track A's `AppError` is not on `main` yet, so the agent cannot throw it.

## Decision

- A schema failure (`NoObjectGeneratedError` from the AI SDK) is retried exactly once, with the validation message quoted back under a `# Correction` heading. A second failure records the run as `invalid_output` and throws `AgentRunError` with `code: 'invalid_output'`, `status: 422`.
- Any other failure records the run as `error` and throws `AgentRunError` with `code: 'agent_failed'`, `status: 502`. The provider's message is stored in `agent_runs.error`.
- Tokens and latency of every attempt are summed into the single `agent_runs` row of the run.
- The mock provider answers a request without a fixture with a JSON object that fails the schema, so the path is the same `invalid_output` outcome a real model would produce.

## Alternatives considered

- **No retry.** Cheaper, but one malformed answer would fail a demo request that the next call would get right.
- **Unlimited or three retries.** Costs latency and money on a model that is confidently wrong; the second failure is already the signal.
- **Throw `AppError` from the agent.** It lives in Track A's A0, which is not on `main`; a local error class with the same two fields (`code`, `status`) lets the integrator map or replace it in one place.
- **Mock throws its own "no fixture" error.** Diverges from what a real provider does and adds a branch the workflows would have to handle only in demo mode.

## Consequences

- `submit-request` (A7) maps `AgentRunError` to the API: 422 `invalid_agent_output` and 502 `agent_failed`, as the plan already specifies.
- The second attempt is visible in the prompt the model received, which the live eval can inspect.
