# Dashboard assistant: a daily cap on turns

## Context

The hosted demo runs in demo mode until the submission (`2026-11-08-hosted-at-dealingwith-si-demo-mode-until-submission`): anyone with the URL can enter as the provider and open the dashboard assistant added on 2026-11-10 (`2026-11-10-assistant-anthropic-adapter-on-backend`). Each chat message runs several model turns (the lead agent delegates to sub-agents, each tool round is a turn), and the browser decides how many messages to send. The Anthropic key carries a monthly spend limit, but one busy visitor could exhaust it before the judges arrive.

## Decision

An in-memory counter (`apps/backend/src/assistant/daily-cap.ts`) allows `ASSISTANT_DAILY_TURN_LIMIT` turns per UTC day across all visitors, default 400; `0` turns the assistant off without removing the key. A turn is counted after the request is validated and before Claude is called, failures included. Past the limit the route answers 429 with the code `assistant_daily_limit` and says when it resets. Each turn logs one `assistant.turn` line (model, effort, outcome, stop reason, token usage, duration; never prompt or answer text), so spend can be read from the service log.

## Alternatives considered

- **Per-visitor limits.** Demo sessions are shared logins with no stable identity; an IP limit is easy to step around and harder to explain.
- **A counter in Postgres.** Survives restarts and scales across instances, but the service is one process and a restart resetting the count errs towards availability for judges.
- **Rely on the provider's spend limit alone.** It stops everything at once, the quoting agent included, with no warning in the product.

## Consequences

At about 400 turns a day the worst case is bounded and predictable on Sonnet 5.5's pricing. A restart resets the count. Scaling to more than one instance, or real authentication, should move the counter to the database or to per-account limits.
