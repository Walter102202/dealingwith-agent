# The quote card names the object, the button names the action

## Context

The design (section 7.7) and the plan (Task D3) named the quote card's accept control "Accept and pay with PayPal". The decision of 2026-11-08 on the single approve-link payment path turned the control into one `PayWithPayPal` button that reads "Pay with PayPal" (or "Accept at no cost" for a zero total), and the card kept the spec's text as a label above it. A Track D review deferred the result as cosmetic: the row read "Accept and pay with PayPal" over a button reading "Pay with PayPal", and "Accept" over "Accept at no cost".

## Decision

The label above the button reads "Accept quote v<version>" in every case; the button alone names the action. The spec string "Accept and pay with PayPal" is no longer rendered anywhere. Tests assert the new label.

## Alternatives considered

- **Keep the spec string as the label.** Rejected: two different verbs for one action on one row.
- **Drop the label entirely.** Rejected: the label pins the version being accepted next to the action, which matters because accept is version-bound (`CONSTITUTION.md`, Article II.3) and a newer version can appear while the card is open.
- **Rename the button to the spec string.** Rejected: "Pay with PayPal" is the wording PayPal's own guidelines and the demo script use, and the zero-total case has no payment.

## Consequences

`QuoteCard.tsx` and its tests change; no API, contract or document outside the component is affected (`docs/demo-script.md` and the README already say "Pay with PayPal" and "Accept at no cost"). Partially supersedes the wording in [2026-11-08 single approve-link payment path](2026-11-08-single-approve-link-payment-path.md), which keeps every other point.
