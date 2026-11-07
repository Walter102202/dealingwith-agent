# DealingWith Agent — Milestones

A working guide for the MVP build. Milestones are outcomes, not dates. Each stage has a "done when" check; tick it when it is true on `main` and pushed. Task ids (T1, A5, D3…) point to the implementation plan: `docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md`. The approved design is `docs/design/2026-11-07-dealingwith-agent-mvp-design.md`. What the MVP leaves out is in `docs/roadmap.md`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

**Current position:** M0 in progress (T1 done).

---

## M0 — Foundation ready

Everything the parallel tracks depend on exists and is frozen.

- [x] **Repository public with CI** (T1). Done when: `Walter102202/dealingwith-agent` is public with the MIT license visible, `docs/hackathon/` is ignored, and `pnpm lint`, `pnpm typecheck`, `pnpm test` are green in GitHub Actions.
- [ ] **Shared contracts** (T2). Done when: `@dealingwith/contracts` exports the schemas for catalog, scope, agent output, quotes, mandates, policy decisions, payments and MCP tools, with money helpers tested.
- [ ] **Database schema and client** (T3). Done when: the ten tables migrate on PGlite and Postgres from the same SQL, and the test database helper works.
- [ ] **Demo seed and reset** (T4). Done when: seeding twice yields one business, three services, project P1 with clauses C1–C3 and mandate M1 pending; reset restores that state while keeping the mandate's funding.

---

## M1 — Commerce core works locally

A quote can be priced, accepted and paid end to end against the mock PayPal gateway, with no credentials.

- [ ] **Pricing engine** (A1). Done when: included lines cost US$0 and cite a clause; rule lines price from the catalog; the rush multiplier applies; unknown refs fail loudly; version drift resolves to the current rule.
- [ ] **Requests, quote versions, project scope** (A2). Done when: a new version supersedes the previous one and paid extras are appended to the project as clauses exactly once.
- [ ] **Policies** (A3). Done when: every reason (inactive, expired, wrong project, currency, stale version, per purchase, total, funding) is tested and the spend reservation holds a row lock.
- [ ] **Mock PayPal gateway** (A4). Done when: create, approve, capture, authorize and partial capture behave like the sandbox, with a local approve page and emitted webhooks.
- [ ] **Payments and workflows** (A5). Done when: web accept returns an approval link; agent accept pays within the mandate or returns `approval_required`; capture and webhooks are idempotent; mandate funding activates the mandate.
- [ ] **Access** (A6). Done when: demo sessions are signed cookies and agent tokens are hashed, revocable and come with connection snippets.
- [ ] **HTTP API** (A7). Done when: the routes of the plan answer with validated bodies, SSE events stream per project, the built web is served statically and `/healthz` responds.

---

## M2 — Agent quotes with any provider

The DealingWith Agent interprets requests against the project's scope and produces structured intents, with Claude, OpenAI or the mock provider interchangeably.

- [ ] **Context pack** (B1). Done when: the pack for P1 carries services, rules, clauses (including paid additionals), prior quotes and mandate summary, every item with its id.
- [ ] **Provider switch and structured run** (B2). Done when: `LLM_PROVIDER=anthropic|openai|mock` selects the model, the output is validated against the schema, and every run is recorded in `agent_runs`.
- [ ] **Live eval** (B3). Done when: `pnpm eval:live` grades the five demo requests and reports pass or fail per request.

---

## M3 — Agents can transact through MCP

An external agent, with a token issued in the portal, requests quotes and pays within its mandate.

- [ ] **MCP server** (C1). Done when: the eight tools and the `quote://` resource work over Streamable HTTP with the bearer header and the capability URL; unknown or revoked tokens get 401; scopes limit tools to the client's projects.
- [ ] **Connection guide** (C2). Done when: `docs/mcp.md` documents auth and tools, and the snippets are verified against Claude Code locally.

---

## M4 — Web experience complete

Humans can do everything the agent can, and see what the agent did.

- [ ] **App shell** (D1). Done when: routing, demo login, typed API client and the visual system are in place.
- [ ] **Storefront** (D2). Done when: the three services are visible and a fixed-price service can be bought.
- [ ] **Project page and quote card** (D3). Done when: a request produces a quote card with included and extra lines, rationale and sources, and the page updates live when a payment completes.
- [ ] **Mandate panel and Connect my agent** (D4). Done when: a mandate can be set and funded, remaining budget and headroom are visible, tokens can be issued and revoked.
- [ ] **Return pages** (D5). Done when: PayPal redirects land on a receipt or on the funded mandate.
- [ ] **Provider dashboard** (D6). Done when: the AG Studio dashboard shows revenue by service, pipeline, unpaid additionals and requests over time with the product theme, and "Reset demo data" works. Fallback: the same with AG Grid and AG Charts Community if AG Studio cannot be used.

---

## M5 — Connected to real services

The same code runs against PayPal sandbox, a real model and Render.

- [ ] **Sandbox gateway** (I1). Done when: orders, captures, authorizations and partial captures succeed in the sandbox; the smoke script records the authorization expiry and the Vault probe result.
- [ ] **Webhooks verified** (I2). Done when: a sandbox capture produces a verified, processed webhook and a resend is recorded as duplicate.
- [ ] **Live model passes** (I3). Done when: the live eval passes five of five with Anthropic and with OpenAI using the same prompts.
- [ ] **Deployed on Render** (I4). Done when: the hosted URL serves the app, the webhook points at it, the demo mandate is funded once, and MCP works from Claude Desktop and Claude Code against the hosted URL.
- [ ] **Pre-submission checks** (I5). Done when: a fresh browser completes the five demo requests on the hosted URL, CI is green, nothing private is in the repo, both Render services are on Starter.

---

## M6 — Submitted

- [ ] **README final** (S1). Done when: URL, demo logins, judge buyer account, video, judge path, architecture, flows and limits are in the README.
- [ ] **Video** (S2). Done when: a public YouTube video under three minutes follows `docs/demo-script.md`.
- [ ] **Devpost** (S3). Done when: the submission is complete with repo, video, hosted URL and the AG Grid sponsor prize opted in.

---

## Walter's actions (outside the code)

- [ ] AG Studio trial license key requested.
- [ ] PayPal sandbox: US business account, US personal (judge) account, REST app linked to the US business account; credentials only in the local `.env`.
- [ ] Render account ready with the sponsor credits.
- [ ] YouTube channel ready.
- [ ] Devpost project draft opened.
- [ ] Execution mode chosen (subagents, hybrid with Codex, or native).
