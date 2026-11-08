# One payment path in the web: the approval link, in every PayPal mode

## Context

Spec section 7.4 gives the web the PayPal JS SDK buttons in sandbox mode (`createOrder` calls our accept endpoint, `onApprove` calls our capture endpoint) and a mock approve page in mock mode, while the MCP `accept_quote` tool returns the approval link for a human to open. Track D built both web paths and kept the sandbox branch in one lazily loaded file. By 2026-11-08 the approval-link path had been exercised end to end against the real backend (web, mock PayPal, receipt page, webhook capture) and by the agent through MCP; the JS buttons had never run against PayPal.

## Decision

Walter decided on 2026-11-08: the web uses one path in every mode. `POST /api/quotes/:id/accept` returns `approvalUrl`; the browser goes there (PayPal's checkout in sandbox, our mock approve page in mock) and PayPal returns to `/pay/return?token=<orderId>`, which captures and shows the receipt. The button reads `Pay with PayPal`; a zero total reads `Accept at no cost` and is paid in place. `@paypal/react-paypal-js` and `PayPalSandboxButtons.tsx` are removed. This supersedes the web half of spec section 7.4 point 2; the spec file is not edited, this record is the deviation.

## Alternatives considered

- Keep both paths as built: two flows to test against the sandbox, to record in the video and to explain to judges; the buttons depend on a third-party script, the client id at build time and their own capture callback, none of which had been run.
- Keep only the buttons: the agent path and the mock path already depend on the approval link, so the link path cannot go away; the buttons were the only removable one.

## Consequences

One flow to verify in I1 and I4 and to show in the demo. The sandbox checkout opens as a page instead of inside our site, so the web looks less "embedded"; the buttons can return after the hackathon once the link path is proven in production. The backend capture route still needs no browser cookie for `pay_now` orders (Task A9 item 2), because the return page may open in another browser.
