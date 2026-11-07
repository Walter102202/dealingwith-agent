# DealingWith Agent — MVP design for the PayPal AI Hackathon

**Status:** approved by Walter on 2026-11-07 (demo script with the US$60 alert confirmed; sandbox buyer account in the README accepted as the designer's call). Written 2026-11-07, revised the same day after an independent builder check (section 13 lists the calls made). Implementation plan: `docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md`. Hackathon deadline: Thursday 2026-11-12, 12:00 PST (17:00 America/Santiago). Judging 2026-12-01 to 2026-12-15; winners announced around 2026-12-21.

**Promise:** Turn service requests into paid work.

**One sentence:** A service business publishes its services and pricing rules once; clients, or their AI agents, ask for work in plain language; the DealingWith Agent interprets the request against the contracted scope, prices it with deterministic rules, explains the price, and the client pays with PayPal. Humans use the web, agents use our MCP server, and both operate on the same versioned quotes and payments.

This document is written for the builder. It states what is decided, what is out of scope, and what is left to the builder's judgment. The product vision behind it is longer than this MVP; the MVP is what must exist on 2026-11-12.

---

## 1. Intent and why

Freelancers and small service firms lose time preparing quotes and chasing payment for extras, and their clients increasingly delegate purchasing to AI assistants. Today a client's agent can buy a product from a catalog, but it cannot contract custom work whose scope and price change: "is this already included in what I paid for?" and "what does the extra cost, and why?" are unanswered.

DealingWith Agent answers them. The hero flow is the **change order during a project**: the client asks for something, the agent says what is already included (US$0), what is extra and why, with a price derived from the provider's own rules, and the client (or their agent, within a pre-authorized budget) pays with PayPal. The project updates with the new scope.

Why this shape for the hackathon:

- The hackathon requires meaningful use of PayPal (sandbox) and AI, with PayPal "central to the project". Payments are the core transaction of this product, not a bolt-on.
- Judging uses five equally weighted criteria (Technological Implementation, Design, Potential Impact, Innovation/Idea, Presentation), judges are not required to run the project, and ties break on Technological Implementation. A complete, verifiable money flow with a visible control point beats a broad but shallow build.
- PayPal's own inspiration list asks for agents that "actually transact", freelancer billing, and agent-to-agent settlement; its stated open problems are consent, mandates, liability when an agent errs, and small merchants lacking expertise. The mandate model below speaks that vocabulary.

---

## 2. Goals (true on 2026-11-12)

| # | Goal |
|---|------|
| G1 | A hosted demo (Render) that judges can use with no API key of their own: seeded provider, client, active project, one-click demo logins, and a sandbox buyer account documented in the README for PayPal approvals. |
| G2 | **Web change order, end to end:** client types a request on the project page → AI quote (versioned, explained, each line marked included or extra with the rule and scope clause it comes from) → PayPal approval → server capture → webhook-confirmed → project shows the new scope and payment. |
| G3 | **Agent change order, end to end via MCP:** from Claude Desktop, Claude Code or Cursor, the client's agent requests a quote, accepts it within a pre-authorized budget, and the server captures the payment without the human present. A request over the per-purchase or remaining budget returns `approval_required` with a PayPal approval link instead of paying. |
| G4 | "Connect my agent" in the client portal issues a token and shows ready-to-paste configuration for Claude Desktop, Claude Code and Cursor (Codex if its remote MCP syntax is verified). |
| G5 | Provider dashboard built with **AG Studio** (AG Grid's embedded analytics library): revenue by service, quotes pipeline by status, unpaid additionals, requests over time, custom theme. Stretch: a natural-language widget via the Studio Agent Framework. This targets the "Best Use of AG Grid" sponsor prize. |
| G6 | Storefront: a fixed-price service can be bought directly with PayPal (minimal, one page). |
| G7 | Technical quality that a judge can see in the repo: webhook signature verification, idempotent PayPal calls (`PayPal-Request-Id` plus database unique keys), versioned quotes, deterministic pricing engine, five scenario tests passing in CI. |
| G8 | Public repository (MIT) with README (problem, demo URL, video, how judges test, architecture, MCP connection, PayPal flows, limits), `AGENTS.md`, YouTube video under 3 minutes, Devpost submission completed before the deadline. |

## 3. Non-goals (out of scope for the hackathon)

- Self-service onboarding of providers, signup, real authentication. Demo sessions are seeded; a "demo mode" login page offers "Enter as client" and "Enter as provider".
- Multi-tenant: one business is seeded. The data model keeps `business_id` everywhere so the product can grow, but no UI exists to create another.
- File uploads on requests.
- Learning from provider corrections (the ACE-style loop in the vision document).
- Observability beyond an `agent_runs` table and structured logs.
- PayPal live mode. Sandbox only.
- PayPal Invoicing, Subscriptions, Payouts, Disputes, PYUSD. Orders v2 (capture, authorize, partial capture), webhooks and, as a stretch, Vault are the only PayPal surfaces.
- OAuth for the MCP server (about a day of work). Token authentication only; the README names OAuth as the production path.
- Multi-currency. USD only. The story is a Chilean provider billing foreign clients in USD.
- The "custom service before contracting" journey (new request outside a project) is supported by the same engine and MCP tool, but gets no dedicated UI polish.

## 4. Anti-goals (a failure even if it works)

- The agent spends money without a mandate the human set and can see. Every autonomous capture must point to a mandate with limits and remaining budget.
- The LLM computes prices. Amounts come only from the pricing engine; any amount in the model output is ignored.
- The quote accepted differs from the quote paid. Accept and pay reference `(quote_id, version)` and only the latest published version is acceptable.
- A thin wrapper over PayPal's MCP server, or a demo where PayPal is a logo rather than a transaction.
- Secrets committed, or the demo down during judging (2026-12-01 to 2026-12-15).
- Any non-English material in README, video or Devpost description.

## 5. Constraints

- **Time:** about 4.5 days from 2026-11-07 evening, one person plus coding agents. Half a day is reserved for the video and submission.
- **PayPal sandbox:** the developer account exists; the REST app, sandbox business and personal accounts are not created yet (day 0 task). The sandbox **business account is created as a US account** so that authorize, partial capture and card checkout are available; the Chilean provider in the story would use a PayPal Chile business account in production, and the README says so. A dedicated **sandbox buyer account for judges** (email, password, funded balance) is created on day 0 and published in the README, as the hackathon rules expect ("test account credentials ... sandbox login details necessary to run and test"). Known sandbox issues as of 2026-11-07: PayPal-wallet vaulting may be refused (`NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE`), the hosted PayPal MCP server has had outages (we do not depend on it), rate limit 50 requests per minute per IP, webhooks need a public HTTPS endpoint. PayPal's documentation states that sandbox authorizations do not expire after 29 days; the builder verifies this on day 1 by reading `expiration_time` on the first authorization created.
- **Judges:** no LLM API keys of their own; they may not run the project; the hosted URL and the video are decisive. The demo must stay up until 2026-12-15. Both the Render web service and the Postgres instance run on the paid **Starter** plan (about USD 7 per month each), covered by the sponsor's USD 50 credits, so there is no spin-down and no free-tier expiry. The MCP endpoint in particular must answer `initialize` within a few seconds.
- **AG Studio** is React-based and needs a 45-day trial license. Walter requests the trial key on day 0 at https://www.ag-grid.com/studio/license-pricing/ . **Pivot date:** if the key is not in hand by the end of 2026-11-09 and AG Studio does not run in trial mode without it, the dashboard is built with AG Grid Community plus AG Charts Community (free), keeping custom theming and widgets so it still competes for the sponsor prize, with lower odds. PayPal's boilerplate with AG Studio and PayPal wired (https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate) is a **reference**, not the base of the repo; the builder lifts components from it only if its stack is React + Vite.
- **Rules:** public repo on GitHub with an open-source license visible in the About panel; public YouTube video under 3 minutes showing the project working, no third-party copyrighted music; PayPal and AI named in description, "Built With" and video; nothing edited after the deadline; project available free of charge until 2026-12-15.
- **Stack decided by Walter:** React + Vite + TypeScript web; Node + TypeScript + Hono backend; PostgreSQL; remote MCP server; PayPal called only from the backend; the internal agent is a tool-use loop built with the Vercel AI SDK (not the eve framework, which is in preview); LLM is Claude or OpenAI via API, provider chosen by environment variable. No Next.js.

---

## 6. Demo scenario (seed data)

Fictional, English-language, consistent across web, MCP and video.

**Provider:** Andes Data Studio, a data consultancy in Santiago, Chile, billing in USD to foreign clients. Owner account: `owner@andesdata.example`.

**Services and pricing rules:**

| Service | Rules (id) | Includes | Excludes |
|---|---|---|---|
| S1 Analytics dashboard build | US$1,200 fixed (`S1.price.v1`) | up to 5 views, including a per-branch view; one data source; two revision rounds | automations, scheduled emails and alerts; additional data sources |
| S2 Automations | scheduled report email US$80 (`S2.report.v1`), delivery 1 day; threshold alert email US$60 (`S2.alert.v1`), delivery 1 day | one automation per rule, on an existing dashboard | new views, new data sources |
| S3 Data source integration | US$150 base (`S3.base.v1`) + US$40 per source (`S3.per_source.v1`); rush under 48 h +25% (`S3.rush.v1`) | connector, validation, one view update | dashboard redesign |

Rules carry ids and versions so a quote can cite them.

**Client:** Lukas Retail GmbH (Germany), contact Mara Keller, `mara@lukasretail.example`.

**Project P1:** "Retail KPI dashboard", contracted S1 on 2026-10-20, status in progress. Scope clauses with ids: C1 "five views including a per-branch view" (included), C2 "automations, scheduled emails and alerts" (excluded), C3 "one data source: Shopify" (included).

**Paid additionals become scope.** When a quote is paid, each extra line is appended to the project as a new clause (`included: true`, `source: {quote_id, version}`); the original contract clauses are never edited. The context pack hands these clauses to the agent, so a request for something already purchased is classified as included at US$0.

**Client agent:** "Mara's assistant", a token issued in the portal.

**Mandate M1:** project P1, per purchase ≤ US$100, total ≤ US$300, currency USD, expires 2026-12-31. The mandate's limits are **policy** and live in our database. Its **funding** is a separate PayPal authorization that a human approves once in the sandbox buyer session after deploy (a seed script cannot approve an order). The seed creates M1 as `pending`; Walter approves the funding authorization once for a larger amount (US$2,000, sandbox money) so that dozens of judge runs fit under PayPal's capture ceiling; the mandate panel shows the policy limits to the user and "Backed by PayPal authorization" with the remaining funding headroom. "Reset demo data" resets quotes, payments, clauses and `spent`, and keeps the funding authorization. When funding headroom falls below the per-purchase limit, the panel shows "Re-authorize" and the README tells judges how (sandbox buyer login).

**Demo requests (the video uses the first three, in this order, from one reset state):**

1. Web, Mara: "I need a per-branch view and a summary email every Monday." → C1 included US$0; `S2.report.v1` extra US$80; delivery 1 day; total US$80 → paid → clause C4 "Weekly Monday summary email" appended.
2. Agent, Mara's assistant: "Add our Amazon sales as a second source, no rush." → `S3.base.v1` US$150 + 1 × `S3.per_source.v1` US$40 = US$190 → over the US$100 per-purchase limit → `approval_required` with approval link.
3. Agent, Mara's assistant: "Alert me by email when any branch's daily sales drop more than 20%." → `S2.alert.v1` US$60 within the mandate → captured automatically → clause C5 appended; the web page updates live.
4. Web or agent: "Send the Monday summary to our regional managers too." → already covered by C4 → included US$0, nothing to pay (shows the engine respects paid additionals).
5. Web: "Make the dashboard load faster." → `needs_info` (data volume or design change?) → shows the clarification path.

A "Reset demo data" action in the provider dashboard (demo mode) restores this state, so judges always find the scripted starting point.

---

## 7. Architecture (decided)

Monorepo with pnpm workspaces, following the agreed tree (`apps/web`, `apps/backend`, `packages/contracts`, `packages/ui`, `tests`, `evals`, `docs`, `infra`, `AGENTS.md`). The folders separate responsibilities; the deployable is one Node process: the Hono server serves the API, the MCP endpoint, the webhook endpoint and the built web app as static files. One Starter web service on Render plus one Starter Postgres instance.

### 7.1 Domain model (Postgres)

| Table | Purpose and key fields |
|---|---|
| `businesses` | name, country, currency, demo flags. One row seeded. |
| `services` | business_id, name, description, `pricing_rules` jsonb (rule id, version, type fixed / per_unit / multiplier, amount, unit, conditions), `inclusions[]`, `exclusions[]`, delivery terms. |
| `clients` | business_id, name, email. |
| `client_agents` | client_id, label, token_hash, scopes, mandate_id nullable, created_at, last_used_at, revoked_at. |
| `projects` | business_id, client_id, title, service_id, status, `scope_clauses` jsonb (clause id, text, included boolean, source: contract or {quote_id, version}), total_contracted. |
| `requests` | project_id nullable, client_id, channel `web` or `mcp`, agent_id nullable, text, status. |
| `quotes` | request_id, version (1..n), status (`draft`, `needs_info`, `published`, `accepted`, `paid`, `superseded`, `expired`, `rejected`), `line_items` jsonb (kind included / extra, label, quantity, unit_amount, amount, rule_ref {id, version}, scope_ref clause id, rationale), subtotal, total, currency, explanation, delivery_days, `needs_info` jsonb, agent_run_id, published_at, accepted_at. |
| `payments` | quote_id, quote_version, mode `pay_now` or `mandate`, paypal_order_id, paypal_authorization_id, paypal_capture_id, amount, currency, status (`created`, `approved`, `captured`, `denied`, `refunded`), idempotency_key unique, raw jsonb. |
| `mandates` | client_id, business_id, project_id, per_purchase_limit, total_limit, spent, currency, expires_at, status (`pending`, `active`, `exhausted`, `expired`, `revoked`), **funding**: paypal_authorization_id, funding_amount, funding_captured, funding_expires_at. |
| `webhook_events` | paypal_event_id unique, event_type, resource_id, payload jsonb, received_at, processed_at, result. |
| `agent_runs` | request_id, quote_id, provider, model, prompt_version, input_tokens, output_tokens, latency_ms, outcome, error. |

Accepting and paying always reference `(quote_id, version)`. Publishing a new version marks the previous one `superseded`.

### 7.2 Pricing engine (deterministic)

Input: line-item intents produced by the agent: `{kind: "included" | "service" | "rule", ref, quantity, params, scope_ref, rationale}`. The engine resolves each `ref` against the current services and rules, computes `unit_amount`, `amount` and totals, and stores the `rule_ref` with its version. Pure function, unit-tested, no LLM involved. If the model emits amounts, they are discarded.

### 7.3 Agent (`apps/backend/agent`)

- `instructions.md`: system prompt. Role: commercial assistant of the provider; interpret, classify each need as included or extra against the scope clauses (contract clauses and paid additionals alike), ask when information changes the price, never invent services or prices, cite the clause or rule for every line.
- `skills/`: short procedure files loaded by task type: `contract-service.md` (new request, no project), `analyze-additional.md` (request inside a project), `explain-quote.md` (rewrite the explanation for the client). Loaded into the prompt as text.
- `context/`: builds the context pack per request: applicable services with rules, the project's scope clauses including paid additionals, prior quotes and their status, the mandate summary (limits and remaining), open questions from previous versions. Every item carries its id so the output can reference it.
- `tools/`: the agent's own read-only tools if the builder chooses a tool loop over a single structured call (`get_project_scope`, `list_services`, `get_prior_additionals`). The builder may instead pass the context pack in one call and use structured output; either is acceptable, prefer the simpler one that passes the evals.
- Output schema (Zod, enforced): `{ line_items: [...intents], needs_info: [{question, why_it_changes_price}], explanation, delivery_days, confidence }`.
- Provider switch via env: `LLM_PROVIDER=anthropic|openai|mock`, `LLM_MODEL`. Both Claude and OpenAI must work with the same code (Walter's requirement); default `anthropic` with model `claude-opus-5-5`; the Vercel AI SDK providers `@ai-sdk/anthropic` and `@ai-sdk/openai` keep the code identical. `mock` returns the fixture outputs used by the scenario tests, so the whole product runs locally without any API key. Demo volume is dozens of calls, cost is negligible.
- Every run is recorded in `agent_runs`.

### 7.4 Payments (`integrations/paypal`, `modules/payments`)

PayPal REST from the server, sandbox, OAuth client credentials cached until expiry. All creating calls send `PayPal-Request-Id` equal to our payment idempotency key.

**Development order (Walter, 2026-11-07): build everything locally first, connect real services at the end.** The PayPal integration sits behind one interface (`PaypalGateway`) with two implementations: `sandbox` (real REST calls) and `mock` (`PAYPAL_MODE=mock`): the mock returns realistic order, authorization and capture objects, exposes a local "approve" page that stands in for the PayPal buyer session, and can emit the same webhook payloads to our own endpoint. Every flow, test and the MCP server run against the mock; switching to the sandbox is a configuration change plus one day of integration testing. Recommendation: create the sandbox app and accounts early anyway (15 minutes) so the switch is not blocked on PayPal's side.

**Flow A, pay now (human approves):**
1. Client accepts a quote → `POST /v2/checkout/orders` with `intent: CAPTURE`, one purchase unit, `custom_id = quote:{id}:{version}`, amount from the quote.
2. Web: PayPal JS SDK buttons; `createOrder` calls our API, `onApprove` calls our capture endpoint. MCP: `accept_quote` returns the `approve` link; the agent hands it to the human.
3. Capture: `POST /v2/checkout/orders/{id}/capture` from our server (idempotent). Payment → `captured`, quote → `paid`, project gains the new clauses. The webhook `PAYMENT.CAPTURE.COMPLETED` confirms the same state idempotently; whichever arrives first wins, the second is a no-op.

**Flow B, mandate (agent pays within budget):**
1. Policy: the client sets the mandate on the project page (limits, expiry) → mandate `pending`.
2. Funding: "Authorize with PayPal" creates an order with `intent: AUTHORIZE` for `funding_amount` (the client chooses; the demo seed proposes US$2,000) → PayPal approval in the buyer session → `POST /v2/checkout/orders/{id}/authorize` → store `paypal_authorization_id`, `funding_amount`, `funding_expires_at` → mandate `active`. Funding and policy are decoupled: the policy limits are what the agent may spend; the funding is the PayPal headroom that backs it.
3. Agent calls `accept_quote` → policies check (7.5) → if allowed, `POST /v2/payments/authorizations/{id}/capture` with `amount`, `final_capture: false`, `PayPal-Request-Id` → payment `captured`, `spent += amount`, `funding_captured += amount`, quote `paid`, project updated.
4. If not allowed → `approval_required` with the reason and a Flow A approval link for that quote. If funding headroom (`funding_amount − funding_captured`) is below the amount, the result is `approval_required` with reason `funding_exhausted` and the mandate panel offers "Re-authorize".

In live, authorizations last 29 days with a 3-day honor period and can be re-authorized; sandbox authorizations do not expire per PayPal's documentation (verified on day 1). The README states this and names Vault as the production path for standing mandates.

**Webhooks:** `POST /api/webhooks/paypal`. Verify with `POST /v1/notifications/verify-webhook-signature` using the webhook id from env; reject on failure. Insert into `webhook_events` with a unique `paypal_event_id` (duplicate → acknowledged, not processed). Handle `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`. Local development uses a tunnel (ngrok or cloudflared) or the sandbox webhook simulator.

**Vault (stretch, P2):** save the PayPal wallet without purchase (setup token → payment token) and charge with the token instead of partial captures. Attempt on day 1; if the sandbox returns `NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE`, stop and keep Flow B.

### 7.5 Policies (`modules/policies`)

`evaluate(mandate, quote) → allow | needs_approval(reason) | deny(reason)`. Checks, in order: mandate active and not expired; same business and project; same currency; quote version is the latest published; `amount ≤ per_purchase_limit`; `spent + amount ≤ total_limit`; `funding_captured + amount ≤ funding_amount`. Reservation happens inside a database transaction with a row lock on the mandate so two agents cannot both pass the same remaining budget. Every decision is returned to the caller with the reason text that the UI and the MCP tool show verbatim.

### 7.6 MCP server (`src/mcp`)

- `@modelcontextprotocol/sdk`, Streamable HTTP transport. Two equivalent ways to present the same per-agent token, both hashed in `client_agents` and revocable from the portal: `Authorization: Bearer <token>` at `/mcp` (Claude Code, Cursor, Codex, `mcp-remote`), and a capability URL `/mcp/<token>` for clients whose remote-connector UI cannot send headers (Claude Desktop custom connectors). The portal snippet shows the header form where the client supports it and the URL form otherwise, with a one-line warning that the link is a secret. OAuth is out of scope (section 3); the README names it as the production path.
- Scopes limit tools to the client's projects.
- Tools: `list_services`, `get_project(project_id)`, `request_quote({project_id?, text})`, `answer_questions({quote_id, answers})`, `get_quote({quote_id})`, `accept_quote({quote_id, version})` → `{status: "paid" | "approval_required" | "denied", reason?, approval_url?, payment?}`, `get_payment({payment_id})`, `get_mandate()`.
- Tool descriptions state explicitly that `accept_quote` can spend money only within the client's mandate and otherwise returns an approval link. Structured results carry the same quote object the web renders.
- Resource: `quote://{id}` as Markdown for clients that render resources.
- Stretch (P2): an MCP Apps UI resource that renders the quote card inside Claude or ChatGPT, using components from `packages/ui`.
- Connection instructions verified live against at least Claude Desktop and Claude Code before recording the video; Cursor and Codex instructions included if verified.

### 7.7 Web (`apps/web`)

- `/` **storefront**: business header, three services with prices and inclusions, "Buy" on fixed-price services (PayPal buttons, Flow A), and a "Describe what you need" box that creates a request and shows the quote.
- `/login` demo mode: "Enter as client (Mara)" and "Enter as provider (Andes Data Studio)".
- `/portal/projects/:id` **project page** (the hero screen): contracted scope clauses and paid additionals, request box, quote cards. A quote card shows each line as included (US$0) or extra with its amount, the rationale, the rule and clause it cites (expandable), delivery, total, and two actions: "Ask for an adjustment" and "Accept and pay with PayPal". A **mandate panel**: set policy limits and expiry, authorize funding with PayPal, see remaining budget, funding headroom and the agent's payments, "Re-authorize" when needed. **"Connect my agent"**: issues a token and shows configuration snippets for Claude Desktop, Claude Code and Cursor with copy buttons and a revoke action.
- `/dashboard` **provider**: AG Studio dashboard with revenue by service, quotes pipeline by status, unpaid additionals grid, requests over time; custom theme matching the product; "Reset demo data". Stretch: a Studio Agent Framework widget answering "show unpaid additionals this month". AG Studio facts verified 2026-11-07: npm package `ag-studio-react` (component `AgStudio`, `data.sources[]` of plain objects, `mode="edit"`), agent framework via `createAiHarness(api, ({tools}) => ({agents, primary}))` with runners `directLlmRunner` (you pass a model adapter), `clientToolRunner` (your server streams the LLM turn; keeps the key server-side) or a custom runner. Use `clientToolRunner` against our backend so the same LLM provider serves it. License: 45-day trial key from https://www.ag-grid.com/studio/license-pricing/ .
- Live updates on the project page through server-sent events when a payment completes, so the video can show the page updating while the agent pays.
- English UI, product-grade visual quality. The builder may load a frontend-design skill when building the UI.

### 7.8 Evals and tests (`evals/`, `tests/`)

Five scenarios as automated tests that use fixed agent outputs (fixtures) with the real engine, policies and payment state machine:

| Scenario | Expected |
|---|---|
| Additional already included (contract clause or paid additional) | line marked included, US$0, no payment created |
| Information missing changes the price | quote `needs_info` with the question, nothing published |
| Request starts via MCP, continues on web | same quote id and version on both channels |
| Payment pending | quote not `paid`, project scope unchanged |
| Duplicate webhook or duplicate accept | one payment, one additional, second call is a no-op |

Plus a live eval script (`evals/live`) that calls the model on the five demo requests and grades structure and classification; it needs an API key and is not part of CI. CI (GitHub Actions): lint, typecheck, tests.

### 7.9 Deployment (`infra/`)

Render Blueprint (`render.yaml`): one web service on the Starter plan (Node 22 LTS, build web then server, health endpoint) and one Postgres Starter instance. Environment: `DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, `PAYPAL_WEBHOOK_ID`, `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, `APP_URL`, `SESSION_SECRET`, `DEMO_MODE=true`. Webhook registered in the PayPal developer dashboard to `https://<app>/api/webhooks/paypal`. Seed is idempotent and runs on deploy; the funding authorization of the demo mandate is a documented one-time manual step after the first deploy.

### 7.10 Repository and documentation

Public GitHub repository `dealingwith-agent` under Walter's personal account, MIT license. README: problem and promise, demo URL and demo logins, sandbox buyer account for judges, video link, how judges test in two minutes, architecture diagram, PayPal flows (A, B, funding, webhooks, idempotency), MCP connection (header and URL forms), evals, known limits (sandbox only, token auth, authorization lifetime in live). `AGENTS.md` for coding agents. `docs/`: this design, `mcp.md`, `demo-script.md`. `.gitignore` excludes `docs/hackathon/` (local analysis) and all `.env*`. Secrets exist only in Render environment variables; the published sandbox buyer credentials are test data, not secrets.

---

## 8. How the product maps to the judging criteria

| Criterion | Evidence in the product |
|---|---|
| Technological Implementation | Deterministic pricing engine with rule refs; versioned quotes; PayPal Orders v2 capture, authorize and partial capture; verified, deduplicated webhooks; idempotent calls; policy engine with row locking and decoupled funding; remote MCP with per-agent tokens; five scenario tests in CI. |
| Design | One quote object rendered identically on web and MCP; explanation per line with its source; mandate panel that makes autonomy visible; the agent asks before pricing when information is missing. |
| Potential Impact | Freelancers and small service firms, a segment PayPal names; quotes and change orders are their daily friction; the provider is a Chilean firm billing abroad in USD. |
| Innovation / Idea | Custom work with variable scope purchasable by agents under verifiable mandates; "included vs extra, explained" as a first-class object; agent-ready service business, not another shopping agent. |
| Presentation | A video that opens on the change-order quote, shows the agent paying within budget and the web page updating live, and ends on the dashboard and the tests. |

---

## 9. Video storyboard (under 3 minutes)

1. 0:00–0:20 Problem and audience: a consultancy, a client asking for "one more thing", the quote nobody has time to write.
2. 0:20–1:00 Web: Mara types request 1 on the project page; the quote card appears: per-branch view included US$0, Monday summary US$80, rationale, rule cited; she accepts and pays with PayPal sandbox; the project shows the new clause.
3. 1:00–1:50 Agent: "Connect my agent" → config pasted into Claude Desktop or Claude Code → Mara asks her agent to add the Amazon source → quote US$190 → over the US$100 per-purchase limit → approval link; she asks for the sales-drop alert instead → US$60 within the mandate → captured → the web page updates live.
4. 1:50–2:20 Provider dashboard (AG Studio): revenue by service, pipeline, unpaid additionals; remaining mandate budget.
5. 2:20–2:50 Under the hood in 30 seconds: rule refs on each line, webhook verification, idempotency, the five tests green, the repo and MCP docs. Close on the promise.

---

## 10. Priorities

- **P0 (must ship):** G1, G2, G3 with Flow A for MCP and Flow B with AUTHORIZE plus partial capture, G4, G7, G8.
- **P1 (needed for the sponsor prize and the story):** G5 AG Studio dashboard with custom theming and widgets; G6 storefront purchase; SSE live updates; "Reset demo data".
- **P2 (stretch, only after P0 and P1 are deployed):** Studio Agent Framework natural-language widget; MCP Apps quote card; Vault.

**Build order:** (1) scaffold, domain model, pricing engine, agent with mock provider, policies, payments against the mock gateway, MCP server, web, tests; (2) connect PayPal sandbox, LLM key, Render deploy, webhook registration, funding authorization, custom domain if wanted; (3) video, README, Devpost submission. Phase 2 is a configuration and integration pass, not new features.

## 11. Left to the builder

- ORM and migrations (Drizzle suggested), test runner (Vitest suggested), lint and formatting.
- Single structured call vs tool loop for the agent, prompt wording, Zod schemas, how skills are loaded.
- Token format and session mechanism for demo logins; SSE vs short polling if SSE proves awkward on Render.
- UI component approach (plain CSS, Tailwind, or a small library), AG Studio layout and theme details, whether `packages/ui` is populated in the MVP or deferred to the MCP Apps stretch.
- Exact MCP client configuration syntax for each client, verified against the clients' current documentation on build day.
- Demo reset mechanics and seed script structure.
- Video recording tooling and script timing within the storyboard above.

## 12. Open decisions for Walter

1. LLM provider and key. Decided 2026-11-07: both Claude and OpenAI must work; the key loaded in Render decides which one runs the demo.
2. Custom domain `dealingwith.si` pointed at Render, or the default `onrender.com` URL for the submission. Decided 2026-11-07: configured at the end, in phase 2.
3. Who implements (Codex with Claude reviewing, or Claude with subagents), to be decided once the plan exists.
4. Demo names, services and prices in section 6. Decided 2026-11-07: accepted as written, including the corrected script (13.2).
5. Dedicated sandbox buyer account (email and password) published in the README for judges. Decided 2026-11-07: yes, designer's call accepted by Walter.
6. Action item on day 0: request the AG Studio 45-day trial key.

## 13. Calls made after the builder check (2026-11-07)

Resolved by the designer, not by Walter; listed so they can be checked while reading.

1. **Mandate funding decoupled from policy.** Limits live in our database; a separate, larger PayPal authorization (US$2,000 in the demo) funds them, approved once by a human after deploy, kept across demo resets, with funding headroom tracked and a "Re-authorize" path. Reason: a seed cannot approve an order, and one US$300 authorization would be exhausted after a few judge runs.
2. **Demo script corrected.** The original script paid for the Monday summary twice (once on the web, once via the agent); a correct agent would have classified the second one as already purchased. The agent scene now buys a US$60 sales-drop alert; S2 became "Automations" with two rules; paid additionals are appended as scope clauses.
3. **Sandbox business account created as US**, buyer account for judges published in the README, as the rules expect.
4. **AG Studio pivot date 2026-11-09** with AG Grid Community plus AG Charts Community as fallback; PayPal's boilerplate is a reference only.
5. **Render Starter plan for the web service too**, not only Postgres, to avoid spin-down and MCP timeouts.
6. **MCP token in header or in a capability URL**, same token, both revocable; OAuth out of scope.
