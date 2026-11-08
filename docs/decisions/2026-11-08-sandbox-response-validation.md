# Validate sandbox responses at the gateway boundary

## Context

The gateway converts external PayPal responses into trusted payment results. An unknown status, missing capture, or non-USD amount cannot safely become a successful payment.

## Decision

Validate consumed response fields with Zod and reject malformed or unsupported results with `INVALID_PAYPAL_RESPONSE` (502). Preserve PayPal issue codes and HTTP statuses for non-success responses. Share in-flight OAuth refreshes and expire the cache sixty seconds early. Send `Prefer: return=representation` for the payment details the gateway consumes.

## Alternatives considered

- Type assertions alone: do not check runtime responses.
- Default unknown capture statuses to completed or declined: could report payment success or release a reservation incorrectly.

## Consequences

Unexpected successful response shapes fail closed without disclosing response bodies or credentials. A new PayPal status requires an explicit mapping. The task-specific I1 file list authorizes wiring `integrations/paypal/index.ts` despite its omission from the track-wide summary list.
