# Reset leaves the agent budget unassigned; the client assigns it each run

Supersedes the funding clause of [2026-11-07 Seed creates, reset restores](2026-11-07-seed-creates-reset-restores.md) ("leaves `paypal_authorization_id`, `funding_amount_cents` and `funding_captured_cents` untouched; keeps `status` except that `exhausted` becomes `active`") and the matching part of spec section 6 and section 13 point 1 (one larger authorization, US$2,000, approved once after deploy and kept across resets). Decided on 2026-11-12 at Walter's request, before the submission video was recorded. The rest of both decisions stands, including [2026-11-07 Reset keeps connected client agents](2026-11-07-reset-keeps-client-agents.md).

## Context

Until 2026-11-12 "Reset demo data" kept the mandate's PayPal funding, so every demo started with the agent budget already funded. A viewer of the video, or a judge, never saw how the agent gets permission to spend: the most important step of agent payments happened once, off screen, months before. Walter asked for the demo to show Mara assigning the budget herself.

## Decision

`resetDemoData` returns mandate M1 to exactly the state a fresh seed creates: `pending`, the seeded limits (US$100.00 per purchase, US$300.00 total, expiry 2026-12-31), `spent_cents` 0, no `paypal_authorization_id`, `funding_amount_cents` and `funding_captured_cents` 0, no `funding_expires_at`. The seed's `funding_amount_cents` changes from 200000 to 0 so the two agree. M1 keeps its id, so connected agents keep pointing at it.

On the project page an unfunded mandate shows its proposed limits and **"Assign a budget to your agent"**. The form opens with per purchase, total and expiry prefilled and editable; changed limits are saved first with the existing `PATCH /api/mandates/:id` (which already accepts a pending mandate), then funding starts with the existing `POST /api/mandates/:id/fund` for what the agent can still spend: the total minus what it already spent, which for a newly assigned budget is the total. There is no separate amount field. PayPal's approval returns to the existing `/portal/mandates/:id/funded` page, which activates the mandate. "Re-authorize" stays for an active mandate whose headroom is below the per-purchase limit and opens the same form.

The old authorization is **not voided** on reset. It is sandbox money, it expires on its own after 29 days, and voiding would add a new PayPal call (a gateway method in both implementations) to a reset that today never talks to PayPal, on the day of the video.

## Alternatives considered

- **Keep the funding across resets and only show the panel in the video.** The original design; it hides the step Walter wants the viewer to understand.
- **Keep a separate "amount to authorize" field.** More control, but one more number for a non-technical client to understand. The authorization equal to the total is the simplest rule that is always enough: the policy already refuses any spend beyond the total.
- **Authorize the total even when part of it is spent (re-authorize).** Holds more than the agent can ever spend; total minus spent is exact.
- **Void the previous authorization on reset or on re-funding.** Cleaner for the buyer's sandbox balance; deferred for the reasons above.

## Consequences

- **PayPal's capture ceiling is never in play.** PayPal lets a merchant capture up to 115% of an authorization or US$75 above it, whichever is less, with partial captures. Our captures are bounded twice below that: `spent + amount <= total limit` and `funding captured + amount <= funding amount` (`apps/backend/src/modules/policies/evaluate.ts`); with the authorization equal to the total, and the limits not raised afterwards, the two checks coincide. The demo needs at most three US$100.00 captures per US$300.00 authorization.
- **Each run needs one PayPal approval with the judge account** before the agent can pay. Until then `accept_quote` returns `approval_required` with reason `mandate_inactive` and the message "The client has not assigned a budget to this agent yet; they can do it on the project page. Approve this payment in PayPal." `get_mandate` reports `pending` and "Backed by PayPal authorization: not yet"; the provider dashboard's agent budget shows the status as "Not assigned yet".
- **The "US$300 authorization is exhausted after a few judge runs" problem of the old design is gone,** since every run authorizes again; so is the renewal of the long-lived hosted authorization that was planned for 2026-11-30.
- **Unvoided authorizations accumulate as holds on the judge's sandbox buyer account,** one per run for 29 days each. If PayPal ever declines an approval for lack of sandbox funds, the fix is to add a void on reset (a `voidAuthorization` gateway method calling `POST /v2/payments/authorizations/{id}/void`), not to restore the old behaviour.
- **Locally in mock mode** the mock gateway keeps authorizations in memory, so a funding kept across a server restart could no longer be captured; a reset now clears that stale state too.
- The first reset on the hosted demo after this change is deployed removes the US$2,000.00 funding approved on 2026-11-08; that is intended.
