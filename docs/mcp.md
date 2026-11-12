# Connecting an agent over MCP

DealingWith Agent exposes the same quoting and payment flow that humans use on the web as an MCP server, so a client's AI agent can request quotes, read them and pay within a mandate. The endpoint runs inside the backend process at `/mcp` (Streamable HTTP, stateless). Verified on 2026-11-08 against `@modelcontextprotocol/sdk@1.32.2`, Claude Code 2.1.319 and the client documentation linked below; the Claude Code setup message was checked on 2026-11-12 against Claude Code 2.1.322.

## Authentication

A client issues an agent token in the portal ("Connect my agent"), or with `POST /api/agents` while signed in as the client. The plain token (`dwa_` + 43 characters) is shown once. Two ways to present it:

- **Header:** `POST https://<host>/mcp` with `Authorization: Bearer dwa_…`.
- **Capability URL:** `POST https://<host>/mcp/dwa_…` with no header, for clients that cannot send headers. Treat the URL as a secret.

Unknown, malformed or revoked tokens get HTTP `401` with body `{ "error": { "code": "unauthenticated", "message": "invalid token" } }` before any MCP parsing. Tokens are revocable from the portal at any time; a revoked token fails on the next request. Every token carries the scopes `quote:request` and `quote:accept` and is bound to one client, and optionally to one mandate. The MCP OAuth flow is the production path and is not part of the MVP.

### What the portal shows

The card shows the token once, in three forms. The API (`POST /api/agents`) returns the token and the `snippets` object from `connectionSnippets` in `packages/contracts/src/access.ts`; the web builds the message and the connector link from those snippets (`apps/web/src/lib/agent-setup.ts`), so the command is written in one place.

1. **Message for Claude Code** (first, with a copy button). Plain words for a non-technical client to paste into Claude Code. It says what DealingWith is for, carries the exact command below, tells the agent how to replace an existing `dealingwith` entry, tells it to keep the key secret, and makes it end with one sentence telling the person to restart Claude Code in the same folder. The full text is in the README, "Connect your agent".
2. **Connector link** for Claude Desktop and claude.ai ([docs](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp), checked 2026-11-08): Settings → Connectors → Add custom connector, paste the capability URL `https://<host>/mcp/dwa_…`, choose "No sign in". Only the URL is copied. The server must be reachable from the public internet (the hosted URL, not localhost).
3. **Technical setup**, collapsed: the Claude Code command, the Cursor JSON and the raw token.

Claude Code command ([docs](https://code.claude.com/docs/en/mcp), checked 2026-11-12):

```text
claude mcp add --transport http dealingwith https://<host>/mcp --header "Authorization: Bearer dwa_…"
```

Cursor, in `.cursor/mcp.json` ([docs](https://cursor.com/docs/context/mcp), checked 2026-11-08):

```json
{
  "mcpServers": {
    "dealingwith": {
      "url": "https://<host>/mcp",
      "headers": { "Authorization": "Bearer dwa_…" }
    }
  }
}
```

### How Claude Code behaves with the message (checked 2026-11-12, Claude Code 2.1.322)

Tested on Windows against a local backend in mock mode: a token issued as Mara in the browser, the message copied with the page's Copy button and pasted into `claude -p` sessions started in an empty temporary folder. The interactive terminal was not driven, so the permission prompt was granted up front with `--allowedTools`.

- **Claude runs the command itself.** Given the message, Claude ran `claude mcp add` with its terminal tool (PowerShell on Windows) and answered with the one sentence the message asks for. In an interactive session the command goes through the usual permission prompt, so the person approves one terminal command.
- **It lands in the local scope.** `claude mcp add` defaults to `local`: the server is stored in `~/.claude.json` under the current project and loads only there ([docs](https://code.claude.com/docs/en/mcp): "A local-scoped server loads only in the project where you added it"). Claude Code takes the project from the nearest parent folder that holds a `.git` entry, falling back to the folder itself; this was observed, not documented.
- **The add fails if the name is taken.** A second `claude mcp add ... dealingwith ...` in the same project answers `MCP server dealingwith already exists in local config` and changes nothing. That happens when a client issues a new token; the message tells the agent to run `claude mcp remove dealingwith -s local` and add again. Pasting the same message a second time in the same folder, Claude hit the error, removed the entry, added it again and ended with the same sentence.
- **The tools appear only in a new session.** The session that ran the command did not see the DealingWith tools afterwards, although Claude Code reported the server as connected. A new session started in the same folder listed all nine tools and called `list_projects` against the local server. The docs do not promise that a running session picks up a newly added server, and `/mcp reconnect all` is documented only as retrying servers that "failed or needs authentication". So the message makes the agent tell the person to close Claude Code and open it again in the same folder.

## Tools

Every tool returns two views of the same result: `content[0].text` is Markdown for the model, `structuredContent` is the typed object from `@dealingwith/contracts` (`packages/contracts/src/mcp.ts`). Money is integer cents in `structuredContent` and `US$80.00` strings in the text. Errors a tool can hit (not yours, not found, cannot accept) come back as a tool result with `isError: true` and the message as text, never as a protocol error. Invalid arguments are rejected by the schema before the handler runs, also as an `isError` result whose text names the field (for example `text is required`); nothing is persisted.

### `list_services`

Services and pricing rules of the agent's provider.

```json
{ "name": "list_services", "arguments": {} }
```

```json
{ "services": [ { "id": "…", "name": "Automations", "pricingRules": [ { "id": "S2.alert", "version": 1, "type": "fixed", "label": "Threshold alert email", "amountCents": 6000 } ], "deliveryDays": 1, "…": "…" } ] }
```

### `list_projects`

The client's projects with id, status and contracted amount. Call it first: `get_project` and `request_quote` take the `projectId` it prints. The Markdown text carries the ids too, so a model that only reads text can copy them.

```json
{ "name": "list_projects", "arguments": {} }
```

```json
{ "projects": [ { "id": "a0000000-0000-4000-8000-000000000031", "title": "Retail KPI dashboard", "status": "in_progress", "totalContractedCents": 120000, "scopeClauses": [ "…" ] } ] }
```

### `get_project`

One of the client's projects with its scope clauses. A project of another client answers `project not accessible`.

```json
{ "name": "get_project", "arguments": { "projectId": "a0000000-0000-4000-8000-000000000031" } }
```

```json
{ "project": { "id": "…", "title": "Retail KPI dashboard", "status": "in_progress", "totalContractedCents": 120000, "scopeClauses": [ { "id": "C2", "text": "Automations, scheduled emails and alerts", "included": false, "source": { "kind": "contract" } } ] } }
```

### `request_quote`

Plain-language request, at most 2000 characters. With `projectId` it is an addition to that project; without it, a new engagement. The agent interprets the request against the contracted scope and the pricing engine prices it; the model never sets an amount.

```json
{ "name": "request_quote", "arguments": { "projectId": "…", "text": "Alert me by email when any branch's daily sales drop more than 20%." } }
```

```json
{ "quote": { "id": "…", "version": 1, "status": "published", "lineItems": [ { "kind": "rule", "label": "Daily sales drop alert (20%)", "amountCents": 6000, "ruleRef": { "id": "S2.alert", "version": 1 }, "rationale": "Alerts are excluded by clause C2 and priced with rule S2.alert.v1." } ], "totalCents": 6000, "deliveryDays": 1, "needsInfo": [] } }
```

The Markdown view:

```text
# Quote <quoteId> v1 — published

- Daily sales drop alert (20%): US$60.00 (Alerts are excluded by clause C2 and priced with rule S2.alert.v1.)

Total: US$60.00
Delivery: 1 days

This adds a threshold alert to your existing dashboard.
```

A `needs_info` quote adds a `Questions:` list; answer it with `answer_questions`.

### `answer_questions`

Answers to a `needs_info` quote. Returns a new version of the same quote id; the previous version is superseded.

```json
{ "name": "answer_questions", "arguments": { "quoteId": "…", "answers": { "Which branches?": "All five" } } }
```

```json
{ "quote": { "id": "<same id>", "version": 2, "status": "published", "…": "…" } }
```

### `get_quote`

Latest version of a quote the client owns.

```json
{ "name": "get_quote", "arguments": { "quoteId": "…" } }
```

```json
{ "quote": { "id": "…", "version": 1, "status": "paid", "totalCents": 6000, "…": "…" } }
```

### `accept_quote`

Accept a quote version. If the client has an active mandate and the amount is within its limits, the payment is captured immediately with PayPal and the response has status `paid`. Otherwise the response has status `approval_required` with an `approvalUrl` that a human must open to pay with PayPal. Never promises payment outside the mandate.

```json
{ "name": "accept_quote", "arguments": { "quoteId": "…", "version": 1 } }
```

Within the mandate (text `Paid US$60.00 (payment <id>).`):

```json
{ "status": "paid", "payment": { "id": "…", "mode": "mandate", "amountCents": 6000, "status": "captured", "paypalCaptureId": "…" } }
```

Above the per-purchase limit, or no mandate (text `Approval required: <message> Open <approvalUrl> to pay with PayPal.`):

```json
{ "status": "approval_required", "reason": "per_purchase_limit", "message": "…", "approvalUrl": "https://…/approve/…", "payment": { "mode": "pay_now", "status": "created", "…": "…" } }
```

Not acceptable (text `Denied: <message>`): `{ "status": "denied", "reason": "stale_version", "message": "…" }`. Only the latest `published` version of a quote can be accepted; accepting again after payment returns `paid` with the same payment.

### `get_payment`

A payment of one of the client's quotes.

```json
{ "name": "get_payment", "arguments": { "paymentId": "…" } }
```

```json
{ "payment": { "id": "…", "quoteId": "…", "quoteVersion": 1, "mode": "mandate", "amountCents": 6000, "currency": "USD", "status": "captured", "createdAt": "…" } }
```

### `get_mandate`

The mandate this token pays from, or `null` when the agent has none (then every acceptance needs human approval).

```json
{ "name": "get_mandate", "arguments": {} }
```

```json
{ "mandate": { "id": "…", "status": "active", "perPurchaseLimitCents": 10000, "totalLimitCents": 30000, "spentCents": 6000, "expiresAt": "2026-12-31T23:59:59.000Z", "funding": { "paypalAuthorizationId": "…", "fundingAmountCents": 200000, "fundingCapturedCents": 6000 } } }
```

## Resource

`quote://{quoteId}` (`text/markdown`): the latest version of a quote, same Markdown as `get_quote`. Scoped to the client like the tools. The resource template is not listable.

## Limits

- Stateless: every request builds a fresh server for the authenticated agent; there are no sessions, no SSE resumption and no server-initiated notifications. Clients that require a session id still work (none is issued; the SDK handles the stateless mode).
- Requests are at most 2000 characters; one quote version per request.
- Tokens are bearer secrets. Revoke and reissue from the portal if one leaks.
- "Reset demo data" in the provider dashboard keeps connected agents and their tokens.

## Local verification (2026-11-08)

Backend started from the `track/c` worktree with `PORT=3002 APP_URL=http://localhost:3002 pnpm dev` (mock PayPal, demo seed). Token issued with `POST /api/session/login {"role":"client"}` then `POST /api/agents {"label":"Local check"}`.

SDK client (`MCP_URL=http://localhost:3002/mcp MCP_TOKEN=… pnpm --filter @dealingwith/backend mcp:smoke`):

```text
Tools (9): list_services, list_projects, get_project, request_quote, answer_questions, get_quote, accept_quote, get_payment, get_mandate
Services (3): Analytics dashboard build, Automations, Data source integration
```

Claude Code 2.1.319, server added from an `--mcp-config` file with the `Authorization` header, prompt "call list_services and reply with the exact tool names available and the names of the services":

```text
Tools:
mcp__dealingwith__accept_quote
mcp__dealingwith__answer_questions
mcp__dealingwith__get_mandate
mcp__dealingwith__get_payment
mcp__dealingwith__get_project
mcp__dealingwith__get_quote
mcp__dealingwith__list_services
mcp__dealingwith__request_quote

Services:
Analytics dashboard build
Automations
Data source integration
```

## Hosted verification (2026-11-08)

Against the Render deployment, first on its Render URL (`https://dealingwith-agent.onrender.com`) and the same day on the domain `https://dealingwith.si` (PayPal sandbox, Anthropic model), with a token issued from the hosted portal and revoked afterwards:

- `MCP_URL=https://dealingwith-agent.onrender.com/mcp MCP_TOKEN=… pnpm --filter @dealingwith/backend mcp:smoke` listed the nine tools and the three services, the same output as the local run above.
- An SDK client over the `Authorization` header ran the agent path of demo request 3 (`list_projects`, `request_quote` "Alert me by email when any branch's daily sales drop more than 20%.", `accept_quote`): the quote came to US$60.00 and `accept_quote` returned `paid`; PayPal captured US$60.00 against the mandate's authorization and the service log recorded `webhook.processed` for the capture.
- The capability URL `https://dealingwith-agent.onrender.com/mcp/dwa_…` with no header listed the same nine tools, which is the path Claude Desktop and claude.ai connectors use.
- "Reset demo data" afterwards left the mandate funded and the project back at clauses C1 to C3.

The hosted MCP endpoint is `https://dealingwith.si/mcp`; the Render URL still answers and keeps the PayPal webhook (`infra/README.md`, last section).
