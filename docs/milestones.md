# DealingWith Agent — Milestones

A working guide for the MVP build. Milestones are outcomes, not dates. Each stage has a "done when" check; tick it when it is true on `main` and pushed. Task ids (T1, A5, D3…) point to the implementation plan: `docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md`. The approved design is `docs/design/2026-11-07-dealingwith-agent-mvp-design.md`. What the MVP leaves out is in `docs/roadmap.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

**Current position:** M0, M2, M3, the web (D1-D6), W, A9, E (E2), I1 and I2 done and merged into `main` on 2026-11-08; G1-G3 done the same day; I3 and I4 done on 2026-11-08 (live eval 5/5 with both providers; the service is live at `https://dealingwith-agent.onrender.com` with webhook, funded mandate and MCP verified from outside); G4 done the same day. The domain `https://dealingwith.si` is live since 2026-11-08 (DNS at Hostinger, `APP_URL` points at it; the PayPal webhook stays on the Render host because PayPal's sender does not reach the domain, verified 2026-11-09, see `infra/README.md`). Open: G5, I5 and M6.

---

## M0 — Foundation ready

Everything the parallel tracks depend on exists and is frozen.

- [x] **Repository public with CI** (T1). Done when: `Walter102202/dealingwith-agent` is public with the MIT license visible, `docs/hackathon/` is ignored, and `pnpm lint`, `pnpm typecheck`, `pnpm test` are green in GitHub Actions.
- [x] **Shared contracts** (T2). Done when: `@dealingwith/contracts` exports the schemas for catalog, scope, agent output, quotes, mandates, policy decisions, payments and MCP tools, with money helpers tested.
- [x] **Database schema and client** (T3). Done when: the eleven tables migrate on PGlite and Postgres from the same SQL, and the test database helper works.
- [x] **Demo seed and reset** (T4). Done when: seeding twice yields one business, three services, project P1 with clauses C1–C3 and mandate M1 pending; reset restores that state while keeping the mandate's funding.

---

## M1 — Commerce core works locally

A quote can be priced, accepted and paid end to end against the mock PayPal gateway, with no credentials.

- [x] **Backend foundations** (A0). Done when: `loadEnv` validates every variable with the documented defaults, the logger writes redacted JSON lines, and `AppError`, `compact` and `formatUsd` are tested.
- [x] **Pricing engine** (A1). Done when: included lines cost US$0 and cite a clause; rule lines price from the catalog; the rush multiplier applies; unknown refs fail loudly; version drift resolves to the current rule.
- [x] **Requests, quote versions, project scope** (A2). Done when: a new version supersedes the previous one and paid extras are appended to the project as clauses exactly once.
- [x] **Policies** (A3). Done when: every reason (inactive, expired, wrong project, currency, stale version, per purchase, total, funding) is tested and the spend reservation holds a row lock.
- [x] **Mock PayPal gateway** (A4). Done when: create, approve, capture, authorize and partial capture behave like the sandbox, with a local approve page and emitted webhooks.
- [x] **Payments and workflows** (A5). Done when: web accept returns an approval link; agent accept pays within the mandate or returns `approval_required`; capture and webhooks are idempotent; mandate funding activates the mandate.
- [x] **Access** (A6). Done when: demo sessions are signed cookies and agent tokens are hashed, revocable and come with connection snippets.
- [x] **HTTP API** (A7). Done when: the routes of the plan answer with validated bodies, SSE events stream per project, the built web is served statically and `/healthz` responds.
- [x] **Scenario tests** (A8). Done when: `tests/scenarios/01…05` pass from the repo root and prove the five expectations of spec section 7.8 through the HTTP API.
- [x] **Payment hardening** (A9). Done when: inactive, expired or unfunded mandates and PayPal-side capture failures return an approval link instead of a denial or a 502; an approved order is captured by webhook without a browser session; expired orders are recreated; a fixed-price purchase needs no agent; a pricing failure ends in `needs_info`, never a 422; mandate payments name their mandate and their captures reconcile by invoice id; the webhook id is optional until registered.

---

## M2 — Agent quotes with any provider

The DealingWith Agent interprets requests against the project's scope and produces structured intents, with Claude, OpenAI or the mock provider interchangeably.

- [x] **Context pack** (B1). Done when: the pack for P1 carries services, rules, clauses (including paid additionals), prior quotes and mandate summary, every item with its id.
- [x] **Provider switch and structured run** (B2). Done when: `LLM_PROVIDER=anthropic|openai|mock` selects the model, the output is validated against the schema, and every run is recorded in `agent_runs`.
- [x] **Live eval** (B3). Done when: `pnpm eval:live` grades the five demo requests and reports pass or fail per request.

---

## M3 — Agents can transact through MCP

An external agent, with a token issued in the portal, requests quotes and pays within its mandate.

- [x] **MCP server** (C1). Done when: the eight tools and the `quote://` resource work over Streamable HTTP with the bearer header and the capability URL; unknown or revoked tokens get 401; scopes limit tools to the client's projects.
- [x] **Connection guide** (C2). Done when: `docs/mcp.md` documents auth and tools, and the snippets are verified against Claude Code locally.

---

## M4 — Web experience complete

Humans can do everything the agent can, and see what the agent did.

- [x] **App shell** (D1). Done when: routing, demo login, typed API client and the visual system are in place.
- [x] **Storefront** (D2). Done when: the three services are visible and a fixed-price service can be bought.
- [x] **Project page and quote card** (D3). Done when: a request produces a quote card with included and extra lines, rationale and sources, and the page updates live when a payment completes.
- [x] **Mandate panel and Connect my agent** (D4). Done when: a mandate can be set and funded, remaining budget and headroom are visible, tokens can be issued and revoked.
- [x] **Return pages** (D5). Done when: PayPal redirects land on a receipt or on the funded mandate.
- [x] **Provider dashboard** (D6). Done when: the AG Studio dashboard shows revenue by service, pipeline, unpaid additionals and requests over time with the product theme, and "Reset demo data" works. Fallback: the same with AG Grid and AG Charts Community if AG Studio cannot be used.
- [x] **Product landing page** (L1, 2026-11-09). Done when: `/` explains the product (promise, change-order problem, how it works, MCP and mandates, PayPal flows, provider dashboard) with the real quote card in a read-only preview and doors into the demo; the storefront lives at `/store` and every storefront link points there (`docs/decisions/2026-11-09-landing-at-root-storefront-at-store.md`).
- [x] **Dashboard as a report with custom widgets** (D7, 2026-11-10). Done when: `/dashboard` opens in read mode on Overview, Collections and Agent channel with an Edit toggle; the quotes table (AG Grid), agent budget and KPI tiles are custom Studio widgets that cross-filter with the charts; the dashboard fits a 380 px screen (`docs/decisions/2026-11-10-studio-custom-widgets.md`, `docs/decisions/2026-11-10-dashboard-read-mode-by-default.md`).
- [x] **Cercana favicon** (F1, 2026-11-10). Done when: the approved two-piece D replaces the serif placeholder in browser tabs, SVG and ICO assets are checked at 16 and 32 pixels on light and dark backgrounds, and the production build serves the favicon and Apple touch icon (`docs/decisions/2026-11-10-cercana-favicon.md`).

---

## M5 — Connected to real services

The same code runs against PayPal sandbox, a real model and Render.

- [x] **Sandbox gateway** (I1). Done when: orders, captures, authorizations and partial captures succeed in the sandbox; the smoke script records the authorization expiry and the Vault probe result.
- [x] **Webhooks verified** (I2). Done when: a sandbox capture produces a verified, processed webhook and a resend is recorded as duplicate.
- [x] **Live model passes** (I3; 5/5 with `claude-opus-5-5` and 5/5 with `gpt-6.1-sol` on 2026-11-08). Done when: the live eval passes five of five with Anthropic and with OpenAI using the same prompts.
- [x] **Deployed on Render** (I4; live on 2026-11-08 at `https://dealingwith-agent.onrender.com`: webhook registered and processing, mandate funded with a US$2,000.00 authorization that expires 2026-12-07 and must be renewed on 2026-11-30, MCP smoke and Claude Code verified from outside; the domain `dealingwith.si` follows `infra/README.md`, last section). Done when: the hosted URL serves the app, the webhook points at it, the demo mandate is funded once, and MCP works from Claude Desktop and Claude Code against the hosted URL.
- [x] **Webhook rejections explain themselves** (I2 follow-up, 2026-11-09): a rejected webhook logs `webhook.rejected` with the reason, PayPal's verification status, the host it arrived on and the transmission id, so a delivery to the domain can be told apart from one to the Render host without guessing (`infra/README.md`, "Day to day").
- [ ] **Pre-submission checks** (I5). Done when: a fresh browser completes the five demo requests on the hosted URL, CI is green, nothing private is in the repo, both Render services are on the always-on plans of the Blueprint (`0.5c-512mb`, `0.1c-256mb`).

---

## M6 — Submitted

- [ ] **README final** (S1). Done when: URL, demo logins, judge buyer account, video, judge path, architecture, flows and limits are in the README.
- [ ] **Video** (S2). Done when: a public YouTube video under three minutes follows `docs/demo-script.md`.
- [ ] **Devpost** (S3). Done when: the submission is complete with repo, video, hosted URL and the AG Grid sponsor prize opted in.

---

## W — Web polish after Track D

The thirteen minors Track D's final review deferred, closed without changing the demo (`docs/plans/2026-11-08-web-polish-after-track-d.md`).

- [x] **Visible fixes** (W1). Done when: the dashboard title comes from the session, dead mandates offer no Authorize, the storefront receipt links back to the storefront, every money string is `formatUsd`, charts use the product palette.
- [x] **Correctness fixes** (W2). Done when: the other role is redirected to its own home, contract drift shows one readable sentence, quote line keys never collide, an already captured order in sandbox is reported as paid.
- [x] **Code health** (W3). Done when: `/api/config` is fetched once through a context and the fixtures handlers are split by domain with the same tests green.

## G — Governance and team

Added 2026-11-08 when David joined. Policy: `CONSTITUTION.md`; runbook: `docs/ci-cd.md`.

- [x] **Constitution** (G1). Done when: `CONSTITUTION.md` exists at the root and is cited from `AGENTS.md`, `CLAUDE.md` and the README.
- [x] **CI gates** (G2). Done when: three parallel jobs (`checks`, `build`, `hygiene`) run on every push, each under four minutes, and the run on `main` is green.
- [x] **`main` protected** (G3, Walter). Done when: the ruleset in `infra/github/main-ruleset.json` is active on GitHub and a direct push to `main` is rejected.
- [x] **Gated delivery** (G4; `autoDeployTrigger: checksPass` in effect since 2026-11-08, PRs #6 to #8 deployed only after their green run; with the `main` ruleset a red `main` cannot be produced by a merge). Done when: `render.yaml` sets `autoDeployTrigger: checksPass` and a red CI on `main` does not deploy.
- [ ] **David onboarded** (G5). Done when: David has write access and has read `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md` and `docs/ci-cd.md`.

## S — Dashboard assistant (AG Studio AI)

Added 2026-11-10 on `feat/studio-assistant`. Decisions: `2026-11-10-assistant-anthropic-adapter-on-backend`, `2026-11-10-assistant-no-thinking-replay`, `2026-11-10-assistant-daily-turn-cap`, `2026-11-10-collections-agent-amounts-from-data`.

- [~] **Turn endpoint** (S1). Done when: `POST /api/dashboard/assistant/turn` streams AG events from Claude Sonnet 5.5 for a provider session, is off without `ANTHROPIC_API_KEY`, and stops at `ASSISTANT_DAILY_TURN_LIMIT`.
- [~] **Assistant in the dashboard** (S2). Done when: the AI panel on `/dashboard` answers a data question and adds a chart, with a Fast and a Thorough effort.
- [~] **Collections agent** (S3). Done when: asking for a payment reminder shows a draft whose amounts and total come from the quote data, signed by the provider, and nothing is sent.

## Walter's actions (outside the code)

- [x] Apply the `main` ruleset (active since 2026-11-08, id 26787773): `gh api -X POST repos/Walter102202/dealingwith-agent/rulesets --input infra/github/main-ruleset.json` (G3).
- [~] Give David write access to the repository (G5; invitation with write permission sent on 2026-11-08 to `satisfymath`, pending his acceptance).
- [ ] AG Studio trial license key requested.
- [x] PayPal sandbox: US business account, US personal (judge) account, REST app linked to the US business account; credentials only in the local `.env` (done 2026-11-08; I1 and I2 verified against them).
- [x] Render account ready with the sponsor credits (2026-11-08; US$50 hackathon credit).
- [ ] YouTube channel ready.
- [ ] Devpost project draft opened.
- [x] Execution mode chosen: hybrid, Codex and Claude Code sessions per track with an integrator session (2026-11-07).
