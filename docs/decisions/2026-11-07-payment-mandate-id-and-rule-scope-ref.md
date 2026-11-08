# `Payment.mandateId` and `scopeRef` on rule intents

## Context

Spec section 4 says every autonomous capture must point to a mandate, but `PaymentSchema` carried the mandate only inside the untyped `raw` column, so a reader of the API (web, MCP, judges) could not see which mandate paid. Spec section 7.1 says line items carry the clause they relate to, but a `rule` intent had no place for the clause that excludes the need (for example `C2` for a scheduled email), so the quote card could not show why a line is an extra. Both gaps were found by the independent plan critique on 2026-11-07.

## Decision

`PaymentSchema` gains `mandateId?: Id` (set for `mode: 'mandate'` payments; absent for pay-now). `RuleLineItemIntentSchema` gains `scopeRef?: string` (the excluding clause id when the agent can name one). Both are optional, so nothing already written breaks; the backend mapper fills `mandateId` from the existing `raw.mandateId` and the prompts may cite the clause.

## Alternatives considered

- Leave the mandate in `raw`: invisible to every consumer and to the "why was this paid" story.
- A required `scopeRef` on rule intents: the model cannot always name an excluding clause, and a required field would turn honest uncertainty into validation errors.

## Consequences

The payments list and the MCP responses can show the mandate; the quote card can link an extra to the clause that excludes it. Track A maps the field in the hardening task; Track B may add `scopeRef` to the prompts' worked example.
