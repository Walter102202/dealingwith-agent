# Persist payment preparation before calling PayPal

## Context

Two accepts may arrive together, and the mock delivers webhooks synchronously during capture. Holding a database transaction across that call would block webhook processing. Reserving outside a serialized preparation would spend the mandate twice.

## Decision

Serialize acceptance on the owning request, reserve the mandate and persist the payment and accepted quote in one transaction. Call PayPal after commit using the persisted idempotency key. Repeated accepts resume the same payment without reserving again. Store the mandate id in payment raw metadata for release. Mark paid under a quote row lock and buffer webhook domain events until the outer transaction commits.

## Alternatives considered

- Hold locks across network calls: prevents in-process mock webhook delivery and increases contention.
- In-memory locks: fail across server processes and restarts.
- A separate outbox and reservation table: useful for production, but requires an integrator schema change beyond this track.

## Consequences

Concurrent accepts and capture/webhook races are tested against PGlite. PayPal retries reuse the original operation key. A process interrupted after reservation resumes on another accept. Automated recovery of abandoned reservations remains outside this MVP.
