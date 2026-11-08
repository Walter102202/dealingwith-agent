# PayPal sandbox verification

Run `pnpm --filter @dealingwith/backend paypal:smoke` from the repository root.
The script loads the ignored root `.env`, uses only the sandbox API, and never prints credentials or access tokens.
Approve both links with the personal sandbox account, then press Enter to capture USD 1.00, authorize USD 20.00, partially capture USD 1.00, and probe Vault once.
The return URL is only a landing page; the script performs the capture after both approvals.

## Smoke run 2026-11-08

```text
Smoke run 2026-11-08T03:23:09.269Z (sandbox only)
CAPTURE USD 1.00 approve: https://www.sandbox.paypal.com/checkoutnow?token=8DG27798UN909621D
AUTHORIZE USD 20.00 approve: https://www.sandbox.paypal.com/checkoutnow?token=1U201947CL6105701
```

Walter approved both orders with the personal US sandbox account. The script resumed successfully:

```text
Capture id=7SV98250JN707041N status=COMPLETED
Authorization id=1VK973277F439350U expiration_time=2026-12-07T03:39:57Z
Partial capture id=2FR788955E520164C status=COMPLETED
Vault probe: name=NOT_AUTHORIZED issue=NOT_AUTHORIZED
```

The script checked captured amounts of 100 cents and an authorization of 2000 cents. Vault was probed once and remains out of scope. PayPal returned to the configured localhost landing page, which had no running server; this did not prevent approval or the subsequent successful API captures.

An earlier attempt at 03:22:54Z created two unapproved orders but exited because non-interactive stdin closed. No captures or authorizations were attempted. The current run uses an interactive terminal; only the links above should be approved.
