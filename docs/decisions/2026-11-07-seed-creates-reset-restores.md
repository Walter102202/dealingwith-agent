# Seed creates, reset restores

## Context

The demo seed runs on every deploy and must be idempotent (spec section 7.9). "Reset demo data" must bring the demo back to the scripted starting point while keeping the mandate's PayPal funding, which a human approved once and no script can re-approve (spec section 6). Both touch the same rows, so their responsibilities had to be drawn.

## Decision

`seedDemo` upserts the static catalog (business, services, client) by fixed id and creates the project and the mandate only when they do not exist. `resetDemoData` is the only operation that rewrites demo state: it deletes requests, quotes, payments, webhook events, agent runs and client agents; restores the project's clauses to C1–C3; resets `spent_cents` and the policy limits to the scripted values; and leaves `paypal_authorization_id`, `funding_amount_cents`, `funding_captured_cents` and `status` untouched.

## Alternatives considered

- **Seed overwrites everything.** Simplest, but a redeploy during judging would wipe paid additionals, the funded mandate's authorization id and any state a judge was looking at.
- **Reset also restores the mandate status to `pending`.** Would make the funded mandate unusable until a human re-authorizes; the spec explicitly keeps the funding across resets.

## Consequences

- Redeploys are safe; only the explicit reset changes demo state.
- Catalog edits (prices, inclusions) ship by changing `demo-data.ts` and redeploying.
- A mandate whose status became `exhausted` keeps that status after a reset even though `spent_cents` is zero; the policies module (Task A3) owns the status transitions and may re-activate it. Revisit if the demo needs it.
