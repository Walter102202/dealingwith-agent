# Capture approved orders before recording the approval webhook

## Context

A9 requires a verified approval webhook to capture pay-now orders without a browser session. The mock delivers the resulting capture webhook synchronously. Calling the gateway while holding a database transaction would block that delivery.

## Decision

After signature validation, skip already-recorded approval events, then capture known created/approved pay-now orders outside the webhook transaction. Record the approval event afterwards. Capture and markPaid retain their existing idempotency and row locking. Permit the same pay-now order capability on the HTTP capture route, including repeated reads of its captured result; enforce ownership whenever a valid session is present.

## Alternatives considered

- Call the gateway inside the webhook transaction: deadlocks the in-process mock and retains locks across network calls.
- Record approval before capture: a failed capture could leave a deduplicated event with no automatic retry.

## Consequences

An interruption after capture but before recording approval is safe to retry: the payment is already captured. An external capture failure leaves the approval event unrecorded so PayPal can retry. Tests exercise synchronous webhook delivery, anonymous repeated capture, and a conflicting authenticated owner.
