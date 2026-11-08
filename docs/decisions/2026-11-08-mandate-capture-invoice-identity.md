# Identify mandate captures by quote version

## Context

After a remote capture succeeds, the process may stop before its capture id is persisted. A mandate funding order's custom_id identifies the mandate, not the individual quote payment.

## Decision

Send invoiceId = mandate:{quoteId}:{version} on authorization captures. Resolve matching invoice_id webhooks to the mandate-mode payment for that quote version, even when a newer pay-now fallback also exists. The repository accepts an optional mode filter for this lookup.

## Alternatives considered

- Funding order or authorization id: neither identifies a particular partial capture.
- Unfiltered newest payment: may associate the event with a human fallback instead of the mandate capture.

## Consequences

Signature and amount verification still apply. I1 must map invoiceId to PayPal invoice_id. The mock and interruption regression cover reconciliation before a capture id is known locally.
