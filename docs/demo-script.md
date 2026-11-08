# Demo script (video under three minutes)

Shot list for the submission video, from the storyboard in the design (section 9). Recorded against the hosted URL with PayPal sandbox and a real model. Total on-screen time: 166 seconds. Every click and every typed text is literal; the expected screen is what the recording must show before the next shot starts.

## Before recording (not in the video)

1. Browser tab A: hosted URL, signed in as provider ("Enter as provider (Andes Data Studio)"), on `/dashboard`. Click "Reset demo data" and confirm. Reset keeps the mandate funding and the connected agents.
2. Check the project page of P1 as Mara (tab B, "Enter as client (Mara)"): scope shows C1, C2, C3 and no quotes; the mandate panel shows "Backed by PayPal authorization" with headroom above US$100.00. If it shows "Not authorized yet", click "Authorize with PayPal" and approve with the judge account first.
3. Browser signed in to the PayPal sandbox buyer account (the judge account) so the PayPal popup shows only the confirmation.
4. Terminal 1: Claude Code in an empty folder, no DealingWith server added yet (shot 5 adds it). Terminal 2: the repository, ready to run `pnpm test`.
5. Tabs B (project page) and A (dashboard) stay open for the whole recording; the project page is never reloaded after shot 4, so the live update in shot 7 is real.

## Shots

| # | Seconds | Where | Action | Expected screen |
|---|---|---|---|---|
| 1 | 0–18 | Storefront `/` | Voice-over only: a consultancy, a client asking for "one more thing", the quote nobody has time to write. Slow scroll over the three services. | Andes Data Studio header, three service cards with prices and inclusions. |
| 2 | 18–24 | `/login` (tab B) | Click "Enter as client (Mara)". | Project page "Retail KPI dashboard": scope list with C1 (included), C2 (excluded), C3 (included); request box "Describe what you need"; mandate panel on the right. |
| 3 | 24–40 | Project page | Type `I need a per-branch view and a summary email every Monday.` in the request box and submit. | Quote card v1, published: "Per-branch view" with the Included badge at US$0.00, "Weekly Monday summary email" US$80.00, rationales citing clause C1, clause C2 and rule S2.report.v1; Delivery 1 day; Total US$80.00; buttons "Ask for an adjustment" and "Accept and pay with PayPal". |
| 4 | 40–56 | Project page → PayPal → `/pay/return` | Click "Accept and pay with PayPal", click the PayPal button, confirm in the popup. On the receipt click "Back to project". | Receipt: "The extra is now part of your project scope." Back on the project page: quote marked paid, clause C4 "Weekly Monday summary email" listed under paid additionals. |
| 5 | 56–64 | Project page, aside | Click "Connect my agent", type `Mara's assistant` in "Name for this agent", submit. | "Copy it now; it is not shown again." with the token and the Claude Desktop, Claude Code and Cursor snippets. Pause the recording here, run the Claude Code snippet in Terminal 1, resume. |
| 6 | 64–84 | Terminal 1 (Claude Code) | Type: `Using the dealingwith tools: request a quote on the Retail KPI dashboard project for "Add our Amazon sales as a second source, no rush." and accept it.` | `request_quote` returns the quote: Data source integration: Amazon US$150.00, Additional data source: Amazon US$40.00, Total US$190.00. `accept_quote` answers "Approval required": over the US$100.00 per-purchase limit, with an approval link for Mara. |
| 7 | 84–106 | Terminal 1, then tab B | Type: `Instead request "Alert me by email when any branch's daily sales drop more than 20%." on the same project and accept it.` Then switch to tab B without reloading. | `accept_quote` answers "Paid US$60.00". Tab B: a new quote card "Daily sales drop alert (20%)" US$60.00 already paid, clause C5 under paid additionals, mandate panel spent US$60.00 and headroom reduced, all without a reload. |
| 8 | 106–130 | `/dashboard` (tab A) | Reload once, then hover the charts. | AG Studio dashboard: "Revenue by service" with Automations at US$140.00, "Quotes pipeline" with the US$190.00 Amazon quote open, "Unpaid additionals" listing it, "Requests over time" with today's three requests. |
| 9 | 130–160 | Tab B, Terminal 2, editor, GitHub | 130–136: expand a quote line to show the rule ref S2.alert.v1 and clause C2. 136–143: run `pnpm test` in Terminal 2, show the tail. 143–149: `apps/backend/src/workflows/webhooks.ts`, signature check and `paypalEventId` insert. 149–154: `apps/backend/src/workflows/accept-quote.ts`, idempotency key `mandate:<quoteId>:<version>`. 154–160: repository README and `docs/mcp.md`. | Test tail reads "Test Files 71 passed" and "Tests 289 passed" (update the numbers to the run on the day). |
| 10 | 160–166 | Title card | Text: "DealingWith Agent. Turn service requests into paid work." | Repository URL and hosted URL under the title. |

## Rules while recording

- No speeding up of PayPal or model calls; if a step takes longer than its budget, cut the wait in editing and keep the before and after frames.
- Amounts on screen must read exactly US$0.00, US$80.00, US$190.00 and US$60.00; if any differs, stop, reset and start again.
- Nothing typed differs from this script, so the mock fixtures, the live eval and the video tell the same story.
