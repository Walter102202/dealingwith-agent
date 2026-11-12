# Seed creates, reset restores

## Context

The demo seed runs on every deploy and must be idempotent (spec section 7.9). "Reset demo data" must bring the demo back to the scripted starting point while keeping the mandate's PayPal funding, which a human approved once and no script can re-approve (spec section 6). Both touch the same rows, so their responsibilities had to be drawn.

## Decision

`seedDemo` upserts the static catalog (business, services, client) by fixed id and creates the project and the mandate only when they do not exist. `resetDemoData` is the only operation that rewrites demo state: it deletes requests, quotes, payments, webhook events, agent runs and client agents; restores the project's clauses to C1–C3; resets `spent_cents` and the policy limits to the scripted values; leaves `paypal_authorization_id`, `funding_amount_cents` and `funding_captured_cents` untouched; and keeps `status` except that `exhausted` becomes `active`, because spent is zero again and the funding is still there.

## Alternatives considered

- **Seed overwrites everything.** Simplest, but a redeploy during judging would wipe paid additionals, the funded mandate's authorization id and any state a judge was looking at.
- **Reset also restores the mandate status to `pending`.** Would make the funded mandate unusable until a human re-authorizes; the spec explicitly keeps the funding across resets.

## Consequences

- Redeploys are safe; only the explicit reset changes demo state.
- Catalog edits (prices, inclusions) ship by changing `demo-data.ts` and redeploying.
- After five judge runs exhaust the US$300 total, one reset makes request 3 pay again, which is what the button promises. The policies module (Task A3) owns every other status transition (`pending` → `active` on funding, `exhausted` when `spent + amount` would exceed the total, `expired`, `revoked`).

The client-agents clause is superseded by [2026-11-07 Reset keeps connected client agents](2026-11-07-reset-keeps-client-agents.md). The funding clause (reset keeps the authorization and the status) is superseded by [2026-11-12 Reset leaves the agent budget unassigned](2026-11-12-reset-unassigns-agent-budget.md): reset now returns the mandate to `pending` with no funding.
