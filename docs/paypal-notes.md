# PayPal sandbox verification

Run `pnpm --filter @dealingwith/backend paypal:smoke` from the repository root.
The script loads the ignored root `.env`, uses only the sandbox API, and never prints credentials or access tokens.
Approve both links with the personal sandbox account, then press Enter to capture USD 1.00, authorize USD 20.00, partially capture USD 1.00, and probe Vault once.
The return URL is only a landing page; the script performs the capture after both approvals.

## Smoke run 2026-11-08

```text
Smoke run 2026-11-08T03:23:09.269Z (sandbox only)
CAPTURE USD 1.00 approval requested
AUTHORIZE USD 20.00 approval requested
```

Walter approved both orders with the personal US sandbox account. The script resumed successfully:

```text
Capture USD 1.00 status=COMPLETED
Authorization USD 20.00 expiration_time=2026-12-07T03:39:57Z
Partial capture USD 1.00 status=COMPLETED
Vault probe: name=NOT_AUTHORIZED issue=NOT_AUTHORIZED
```

The script checked captured amounts of 100 cents and an authorization of 2000 cents. Vault was probed once and remains out of scope. PayPal returned to the configured localhost landing page, which had no running server; this did not prevent approval or the subsequent successful API captures.

An earlier attempt at 03:22:54Z created two unapproved orders but exited because non-interactive stdin closed. No captures or authorizations were attempted in that run. The successful run used an interactive terminal.

## Tunnel webhooks — 2026-11-08

Backend on port 3004 in sandbox mode, local PGlite, mock model; Vite on 5174 with its API proxy pointing at port 3004. The public Cloudflare tunnel serves the backend and `/api/webhooks/paypal`. Walter registered the six planned events and the integrator restarted the corrected backend with the webhook ID.

As Mara, submitted demo request 1 through the web: per-branch view included (USD 0), weekly Monday summary email (USD 80). Walter approved the sandbox checkout; the return page displayed Payment received for USD 80. The project subsequently showed quote v1 Paid and one new C4 clause, Weekly Monday summary email.

Backend log evidence (event IDs redacted):

```json
{"eventId":"[redacted]","result":"processed","level":"info","time":"2026-11-08T04:17:27.895Z","msg":"webhook.processed"}
{"eventId":"[redacted]","result":"processed","level":"info","time":"2026-11-08T04:17:41.630Z","msg":"webhook.processed"}
```

Read-only PayPal event-detail calls correlated these IDs to CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED respectively, both for this order. The capture event amount was USD 80.00. Both webhook requests returned HTTP 200 after signature verification. No changes to webhook JSON handling were necessary.

Walter used Resend on the USD 80 PAYMENT.CAPTURE.COMPLETED event in the sandbox Webhooks Events dashboard. Both subsequent deliveries matched the original capture event ID and were deduplicated:

```json
{"eventId":"[redacted]","result":"duplicate","level":"info","time":"2026-11-08T04:19:55.061Z","msg":"webhook.processed"}
{"eventId":"[redacted]","result":"duplicate","level":"info","time":"2026-11-08T04:20:18.070Z","msg":"webhook.processed"}
```

After the re-deliveries, the web project still showed quote v1 Paid and exactly one C4 paid additional. I2 passed: genuine signed approval and capture events processed, capture re-deliveries acknowledged without repeating the scope change.

## Mandate authorization and the capture ceiling — 2026-11-12

Since 2026-11-12 "Reset demo data" leaves the demo mandate unfunded, and each run funds it when Mara clicks "Assign a budget to your agent": one order with intent `AUTHORIZE` for the total limit (US$300.00 with the seeded limits), approved with the judge account (`docs/decisions/2026-11-12-reset-unassigns-agent-budget.md`). Until then the mandate was funded once with US$2,000.00 and kept across resets.

PayPal lets a merchant capture up to 115% of an authorization or US$75 above it, whichever is less, and supports several partial captures within one authorization period ([Authorize and capture](https://developer.paypal.com/docs/integration/direct/payments/capture-payment/), [Authorization and honor period](https://developer.paypal.com/payment-methods/auth-honor)). We never use that allowance: `evaluate.ts` refuses a spend when `spent + amount` exceeds the total limit or `captured + amount` exceeds the authorized amount, so the captures against one authorization add up to at most the authorization. With the seeded limits a run makes at most three captures of US$100.00 against US$300.00; partial captures against an authorization were verified on the hosted sandbox on 2026-11-11 (I5). The previous authorization is not voided on reset; it expires after 29 days.
