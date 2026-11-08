# Keep uncertain PayPal outcomes retryable

## Context

The acceptance workflow treats gateway errors below HTTP 500 as definitive declines and releases reserved spend. PayPal authentication, timeout and throttling failures do not prove a payment was declined.

## Decision

Map PayPal HTTP 401, 403, 408 and 429 to gateway status 503 while preserving the error code and retaining the original HTTP status internally. For an API-call 401, invalidate the rejected cached token and retry once with a fresh token and the same idempotency key. Do not retry token-endpoint failures. Bound fetches to fifteen seconds.

Only a CREATED authorization may activate funding; only a COMPLETED capture supplies a reconciliable capture id. Other authorization states fail with HTTP 502.

This supersedes the blanket HTTP-status preservation in [sandbox response validation](2026-11-08-sandbox-response-validation.md), following the integrator's I1 review.

## Alternatives considered

- Pass every HTTP status through: releases reservations on infrastructure failures.
- Retry every error: risks unnecessary requests and obscures definitive failures.

## Consequences

Credentials, throttling and uncertain outcomes retain reservations. Explicit declines keep their original status. Regression tests cover temporary statuses, bounded token refresh, aborts and non-final payment states. Webhook JSON handling remains unchanged pending real I2 delivery evidence.
