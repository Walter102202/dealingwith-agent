# DealingWith Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. A session that owns one phase or one track uses superpowers:executing-plans for its tasks and follows "How to work on this plan" below. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the DealingWith Agent MVP described in the spec by 2026-11-12 15:00 America/Santiago (two hours before the Devpost deadline): hosted demo on Render, web and MCP change orders paid through PayPal sandbox, AG Studio dashboard, public MIT repo, video.

**Architecture:** pnpm monorepo; one Node process (Hono) serves the JSON API, the MCP endpoint, PayPal webhooks and the built Vite web app. A deterministic pricing engine prices intents the LLM produces; a policy module gates agent spending against a mandate funded by a PayPal authorization. Everything runs locally against a mock PayPal gateway, a mock LLM provider and an embedded Postgres (PGlite); phase 2 swaps configuration to the sandbox, a real model key and Render Postgres.

**Tech Stack:** TypeScript 5.9 (not 7), Node 22, pnpm 10, Hono 4 + `@hono/node-server`, `@hono/mcp` + `@modelcontextprotocol/sdk` 1.32, Drizzle ORM 0.45 (`pg` driver in production, `@electric-sql/pglite` for tests and local default), Zod 4, Vercel AI SDK 7 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`), React 19 + Vite 8 + React Router 8 + Tailwind 4, `@paypal/react-paypal-js` 10, `ag-studio-react` 3 (fallback `ag-grid-community` 36 + `ag-charts-react` 14), Vitest 5, Biome 2, GitHub Actions, Render Blueprint.

**Spec:** `docs/design/2026-11-07-dealingwith-agent-mvp-design.md` (approved 2026-11-07). Progress guide: `docs/milestones.md`. Deferred scope: `docs/roadmap.md`. Local-only context (never committed): `docs/hackathon/`.

## Global Constraints

- Deadline: Devpost closes Thursday 2026-11-12 12:00 PST = 17:00 America/Santiago. Internal cutoff 15:00 Santiago. Nothing is edited on Devpost after the deadline.
- Repo: public GitHub `Walter102202/dealingwith-agent`, MIT license visible in the About panel. Every commit is pushed to its branch immediately (Walter's rule). No force-push, no PRs, no merges without Walter.
- `.gitignore` from the first commit includes `docs/hackathon/`, `.env`, `.env.*`, `.data/`, `node_modules/`, `dist/`, `coverage/`. Secrets live only in `.env` locally and in Render environment variables.
- All committed text (code comments, README, UI copy, docs, video, Devpost) in English. Walter's chat language is Spanish; the product is English-only.
- Money is stored and computed as integer **cents** (`amountCents: number`); converted to PayPal strings (`"80.00"`) only inside `integrations/paypal`. Currency is always `USD`.
- The LLM never computes a price. Any amount in model output is ignored; amounts come only from `priceIntents`.
- Accept and pay always reference `(quoteId, version)`; only the latest `published` version is acceptable.
- Every PayPal creating call sends `PayPal-Request-Id` equal to our idempotency key; every webhook is verified and deduplicated on `paypal_event_id`.
- Runtime configuration via env: `DATABASE_URL` (default `pglite://.data/dev` locally), `PAYPAL_MODE=mock|sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `LLM_PROVIDER=anthropic|openai|mock`, `LLM_MODEL` (defaults: `claude-opus-5-5` for anthropic, `gpt-5` for openai), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `APP_URL`, `SESSION_SECRET`, `DEMO_MODE=true`, `PORT` (default 3000), `MOCK_WEBHOOK_SECRET`.
- Build phases (spec section 10): phase 1 builds everything locally against mocks; phase 2 connects sandbox, model key, Render; phase 3 is video, README, submission. Phase 2 adds no features.
- Tests: Vitest. Unit tests beside the code (`*.test.ts`); the five scenario tests in `tests/scenarios/`. CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test` on every push.
- UI copy uses the spec's exact strings where given: "Enter as client (Mara)", "Enter as provider (Andes Data Studio)", "Ask for an adjustment", "Accept and pay with PayPal", "Connect my agent", "Reset demo data", "Re-authorize", "Backed by PayPal authorization".

## Review Focus

Inputs the spec implies but no scenario test names. Each line is pinned by a test in the owning task.

1. The agent cites a rule id that exists with a different version (`S2.report` v1 requested, catalog now v2). Expected: the engine resolves to the catalog's current version and records that version on the line; it never fails the quote for a version drift. Test in Task A1.
2. Accepting a quote version that is no longer the latest published one. Expected: `denied` with reason `stale_version` and a message naming the current version; no PayPal call. Test in Task A5.
3. Capture called twice for the same order (double click, or web capture and webhook racing). Expected: one `payments` row, one set of clauses, second call returns the existing payment with `status: "captured"`. Test in Task A5.
4. A verified webhook for an order we do not know. Expected: HTTP 200, row in `webhook_events` with `result = "ignored"`, no other change. Test in Task A5.
5. An MCP request with a revoked or unknown token, and a `request_quote` with empty text. Expected: HTTP 401 for the token; a tool error (`isError: true`, message "text is required") for the empty request; nothing persisted. Tests in Task C1.

---

## How to work on this plan

Written for a session (Claude Code, Codex or a human) that opens this repository with no other context.

### Read first, in this order

1. `docs/design/2026-11-07-dealingwith-agent-mvp-design.md` — what we are building and why (the spec).
2. This plan: Global Constraints, Review Focus, this section, then only the phase or track you own.
3. `docs/milestones.md` — where the project stands; update it as you go.
4. `AGENTS.md` — repo conventions (exists after Task T1).
5. `docs/decisions/` — decisions already taken; do not re-open them without a new decision file.

### The decision rule (applies to every session)

When something is unclear, do not stop to ask Walter. Ask yourself what a top 1% software engineer would do here, decide, and write the decision down in `docs/decisions/` (one short file: context, decision, alternatives considered, consequences). Ask Walter only when the answer needs his credentials, his money, or changes what the product is. A question that only needs judgment is yours to answer.

### Working conventions

- One task at a time, in the plan's order inside your track. Each task ends with its tests green, a commit, a push, and the matching line ticked in `docs/milestones.md` (same commit). Tick only your own stage lines; the "Current position" line belongs to the integrator.
- Tests first: write the failing test named in the task, see it fail, implement, see it pass. Keep the test names the plan gives so the five scenarios stay findable.
- Branches: Phase 0 works on `main`. Phase 1 tracks work on `track/a`, `track/b`, `track/c`, `track/d`, `track/e`, each in its own git worktree created from `main` (`git worktree add ../dealingwith-track-a -b track/a main`), pushed on every commit (`git push -u origin track/a` the first time). Tracks never merge into `main` themselves. When a track reports done, the integrator (the planning session) merges it into `main` with a merge commit, with Walter's go-ahead, in the order A, B, C, D, E; no rebase of pushed branches, no force-push. Known planned conflict: `apps/backend/src/agent/port.ts` exists in A (placeholder) and B (real); B's version wins.
- Only the integrator edits `packages/contracts`, `apps/backend/src/db` and the root configuration files (`package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `biome.json`, `tsconfig.base.json`) after Phase 0, except where a task says otherwise (A8 adds the `tests` workspace). If your task needs a new field or schema, write it as a decision file plus a note in your report, and build against a local type extension until the integrator lands it.
- Commits: Conventional Commits (`feat(scope): ...`, `fix:`, `docs:`, `chore:`, `test:`), present tense, one task per commit (small follow-up commits are fine). Never amend a pushed commit, never force-push, never open a PR or merge without Walter.
- Git identity: user `Walter102202`, email `walterguzman2202@gmail.com` (Walter's personal account). Verify with `git config user.name` before the first commit.
- English everywhere in the repo. Walter's chat language is Spanish.
- Secrets only in `.env` (ignored). `docs/hackathon/` is local analysis and is never committed; if you see it in `git status`, stop and fix `.gitignore` first.
- Before you say a task is done, run the task's test command and paste its last lines in your report. Evidence before assertions.

### Quality bar (what "top 1%" means here, checkable)

- TypeScript `strict`, no `any` outside tests, no `@ts-ignore`; public functions typed at the boundary with Zod schemas from `@dealingwith/contracts`.
- Modules small and single-purpose (a file over about 300 lines is a smell); pure functions for engine and policies; side effects only in workflows, API and integrations.
- Every error a user or an agent can hit has a stable `code` and a human-readable `message`; HTTP status codes correct (400 validation, 401 auth, 403 scope, 404 missing, 409 conflict, 422 agent output invalid, 502 PayPal failure).
- Idempotency and concurrency are tested, not assumed (duplicate webhook, double capture, two reservations).
- Logs are structured JSON with `requestId`, never contain tokens or secrets.
- UI: every state exists (loading, empty, error, success), keyboard reachable, labelled inputs, visible focus, 4.5:1 contrast, works at 375 px wide, no console errors; copy in plain English with the spec's exact strings.
- No dead code, no commented-out blocks, no TODOs without a decision file; dependencies added only when they remove real work.
- Docs are part of the deliverable: a judge reads the README and understands the product in two minutes.

### Definition of done for a task

1. The tests named in the task exist and pass (`pnpm test` from the repo root is green).
2. `pnpm lint` and `pnpm typecheck` are green.
3. Committed and pushed; `docs/milestones.md` ticked.
4. Any decision taken has a file in `docs/decisions/`.
5. A short report (what was built, test output tail, decisions, anything the next task needs to know) is left in the chat for the integrator.

### Reporting format (end of each task or session)

```text
Task: A5 - payments and workflows
Status: done | blocked (why) | partial (what is missing)
Tests: <command> -> <last lines of output>
Decisions: docs/decisions/2026-11-08-release-spend-on-paypal-error.md
Notes for the next task: <interfaces added or changed, gotchas>
```

### Never

- Commit secrets, `.env`, or `docs/hackathon/`.
- Call PayPal live endpoints. `PAYPAL_MODE=sandbox` is the only real mode and only in Phase 2.
- Let the model compute or override an amount.
- Change a decided interface in `packages/contracts` without a decision file and a note to the integrator.
- Run `gh auth switch`. If `gh api user -q .login` does not print `Walter102202`, stop and ask Walter to switch accounts himself.

---

## Workstreams and parallelism

```
Phase 0 (one implementer, sequential)      T1 scaffold → T2 contracts → T3 db → T4 seed
                                                      │
Phase 1 (parallel after T4)                           ├── Track A commerce core: A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8
                                                      ├── Track B agent:         B1 → B2 → B3        (needs T4 only)
                                                      ├── Track D web:           D1 → D2 → D3 → D4 → D5 → D6  (needs T2; wires API as A7 lands)
                                                      └── Track E docs/manual:   E1 (Walter), E2 README/AGENTS skeleton
                                           Track C MCP: C1 → C2  (starts after A5 + A6)
Phase 2 (sequential, needs credentials)    I1 sandbox gateway → I2 webhooks → I3 live model → I4 Render deploy → I5 checks
Phase 3                                    S1 README final → S2 video → S3 Devpost
```

Each parallel track works in its own git worktree on a branch named `track/<letter>`; the integrator merges into `main` with merge commits in the order A, B, C, D, E (web after the API it depends on). Tracks only create files under their own folders (listed per task) plus their tests, so merges are trivial. Shared files (`packages/contracts`, `apps/backend/src/db`) are owned by Phase 0 and changed only by the integrator.

Suggested calendar (America/Santiago): Sat 2026-11-08 Phase 0 morning, tracks A/B/D start afternoon; Sun 11-09 tracks continue, C starts, AG Studio pivot decision at 20:00; Mon 11-10 tracks finish, I1–I3; Tue 11-11 I4–I5, README, video draft; Wed 11-12 video final, Devpost by 15:00.

### Phase briefs

**Phase 0 — Foundation (Tasks T1–T4).** Purpose: create the ground every track builds on, and freeze it. Preconditions: Node 22, pnpm 10, git, `gh` authenticated as `Walter102202`. Deliverables: public repo with CI, `@dealingwith/contracts`, Drizzle schema and client factory, idempotent demo seed and reset. Exit criteria: `pnpm lint && pnpm typecheck && pnpm test` green locally and in GitHub Actions; `git ls-files | grep hackathon` empty; `docs/milestones.md` shows M0 done; `docs/decisions/` has the three founding decisions (TypeScript 5.9 over 7, PGlite for tests and local default, integer cents). One session, sequential. Risk: getting the contracts wrong costs every track; when in doubt, mirror the spec's section 7.1 names exactly and prefer adding a field over renaming one later.

**Phase 1 — Build everything locally (Tracks A–E).** Purpose: the complete product running against the mock PayPal gateway, the mock LLM and PGlite, with the five scenarios tested. Preconditions: Phase 0 on `main`. Parallel: A, B, D and E start together; C starts when A5 and A6 are on `main`. Deliverables per track are the tasks' Interfaces blocks. Exit criteria: `pnpm dev` serves the web on the backend; a fresh browser completes the five demo requests of spec section 6 with `PAYPAL_MODE=mock` and `LLM_PROVIDER=mock`; Claude Code connects to the local MCP server and completes request 3 as `paid`; all tests green on `main`; M1–M4 ticked. Risks: tracks drifting from the contracts (use them, do not redefine), the web waiting on the API (D1 ships a fixtures mode), AG Studio license (pivot rule in D6).

**Phase 2 — Connect real services (Tasks I1–I5).** Purpose: the same code against PayPal sandbox, a real model and Render; no new features. Preconditions: Phase 1 exit criteria; Walter's sandbox US business and judge accounts, REST app credentials, model API key, Render account, AG Studio key (or the fallback already built). Sequential, one session, Walter present for approvals in the PayPal buyer session. Exit criteria: hosted URL passes the five demo requests; webhook `processed` in production logs; live eval 5/5 on both providers; mandate funded once and surviving "Reset demo data"; MCP verified from Claude Desktop and Claude Code against the hosted URL; M5 ticked. Risks: sandbox surprises (record each in `docs/paypal-notes.md`), Render cold starts (Starter plan, health check), webhook URL changing with a custom domain (re-register).

**Phase 3 — Submission (Tasks S1–S3).** Purpose: make the work legible to judges. Preconditions: Phase 2 exit criteria, frozen `main`. Deliverables: final README, public YouTube video under three minutes, Devpost submission with the AG Grid sponsor prize opted in. Exit criteria: every README link resolves; the video follows `docs/demo-script.md` from a reset state; Devpost shows "submitted" before the internal cutoff; M6 ticked. After submission nothing changes on `main` until judging ends.

---

## Phase 0 — Foundation

### Task T1: Repository scaffold, tooling, CI, GitHub

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts` (root, `test.projects` listing `packages/*` and `apps/*`), `.gitignore`, `.editorconfig`, `.nvmrc` (`22`), `LICENSE` (MIT, "Copyright (c) 2026 Walter Guzmán"), `README.md` (title, promise, "work in progress"), `AGENTS.md`, `.env.example`, `.github/workflows/ci.yml`, `docs/decisions/README.md`, `docs/decisions/2026-11-08-typescript-5-9.md`, `docs/decisions/2026-11-08-pglite-for-tests-and-local.md`, `docs/decisions/2026-11-08-integer-cents.md`
- Create: `apps/backend/package.json`, `apps/backend/tsconfig.json`, `apps/backend/src/index.ts` (prints "dealingwith backend"), `apps/backend/src/smoke.test.ts`
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts` (empty export). `apps/web` is created by Task D1, not here.

**Interfaces:**
- Produces: root scripts `pnpm lint` = `biome check .`; `pnpm typecheck` = `pnpm -r --if-present typecheck` (each package defines `typecheck` as `tsc --noEmit -p tsconfig.json`); `pnpm test` = `vitest run` at the root (projects); `pnpm dev` = `pnpm -r --parallel --if-present dev`; `pnpm build` = `pnpm -r --if-present build`. Package names `@dealingwith/contracts`, `@dealingwith/backend`, `@dealingwith/web` (web added in D1). Backend `dev` = `tsx watch src/index.ts`, `build` = `tsc -p tsconfig.build.json` to `dist/`, `start` = `node dist/index.js`. `packages/contracts` is consumed from source via workspace `exports` pointing at `src/index.ts` (no build step in dev; `tsc` builds it for production). TypeScript pinned `~5.9.3` (TypeScript 7 is `latest` on npm and is not used; see the decision file).

- [ ] **Step 1: Write `.gitignore` first** with `docs/hackathon/`, `.env`, `.env.*`, `!.env.example`, `.data/`, `node_modules/`, `dist/`, `coverage/`, `.DS_Store`.
- [ ] **Step 2: `git init -b main`; verify `git status --short` lists `docs/design/` and `docs/plans/` but not `docs/hackathon/`.** Expected: no line starting with `docs/hackathon`.
- [ ] **Step 3: Write the workspace files** (`pnpm-workspace.yaml` with `apps/*`, `packages/*`; root `package.json` with `"packageManager": "pnpm@10.30.1"`, `"engines": {"node": ">=22"}`, the scripts above; `tsconfig.base.json` with `strict`, `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, `verbatimModuleSyntax`; `biome.json` with recommended rules, 2-space indent, double quotes off / single quotes on).
- [ ] **Step 4: Write the smoke test** `apps/backend/src/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 5: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`.** Expected: all three succeed, Vitest reports 1 passed.
- [ ] **Step 6: Write `.github/workflows/ci.yml`:** on `push` and `pull_request`; `pnpm/action-setup@v4`, `actions/setup-node@v4` with `node-version: 22` and `cache: pnpm`; steps `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] **Step 7: Write `LICENSE`, `README.md` stub, `.env.example`** listing every variable from Global Constraints with the mock defaults (`PAYPAL_MODE=mock`, `LLM_PROVIDER=mock`, `DATABASE_URL=pglite://.data/dev`, `APP_URL=http://localhost:3000`).
- [ ] **Step 7b: Write `AGENTS.md`** with these sections, in this order: Purpose (one paragraph: what the product is, link to the design and the plan); Repo map (one line per top-level folder); Commands (`pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm --filter @dealingwith/backend seed`, `pnpm eval:live`); Rules that never bend (integer cents, the model never prices, accept and pay reference `(quoteId, version)`, idempotency keys on every PayPal call, verified and deduplicated webhooks, English only, no secrets, `docs/hackathon/` never committed); The decision rule (copy the paragraph from "How to work on this plan" verbatim); Decision log (how to add a file in `docs/decisions/`); Definition of done (copy from the plan); Where tests live.
- [ ] **Step 7c: Write `docs/decisions/README.md`** (format: `YYYY-MM-DD-<slug>.md` with headings Context, Decision, Alternatives considered, Consequences; one decision per file; never edit a past decision, write a new one that supersedes it) and the three founding decisions: TypeScript `~5.9` instead of 7 (tooling compatibility within the deadline), PGlite for tests and local default with `pg` for Render (zero-setup parallel worktrees, same SQL), integer cents for money (no floating point, conversion only at the PayPal boundary).
- [ ] **Step 8: Commit and publish.** Precondition: `gh api user -q .login` prints `Walter102202`; if it prints another account, stop and ask Walter to switch it himself (never run `gh auth switch`; the fallback is Walter creating the empty public repo in the browser, then `git remote add origin https://Walter102202@github.com/Walter102202/dealingwith-agent.git`). Then `git add -A && git commit -m "chore: scaffold monorepo, tooling and CI"`. Create the repository with `gh repo create Walter102202/dealingwith-agent --public --source . --remote origin --description "Turn service requests into paid work. AI agent that quotes and gets paid with PayPal, for humans (web) and agents (MCP)." --push`. Expected: `gh repo view Walter102202/dealingwith-agent --json visibility,licenseInfo` shows `PUBLIC` and `MIT`. Verify with `git ls-files docs | grep -c hackathon` → `0`.
- [ ] **Step 9: Check CI** `gh run watch` → green.

### Task T2: Shared contracts (`packages/contracts`)

**Files:**
- Create: `packages/contracts/src/money.ts`, `packages/contracts/src/catalog.ts`, `packages/contracts/src/scope.ts`, `packages/contracts/src/agent.ts`, `packages/contracts/src/quote.ts`, `packages/contracts/src/mandate.ts`, `packages/contracts/src/policy.ts`, `packages/contracts/src/payment.ts`, `packages/contracts/src/mcp.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/money.test.ts`, `packages/contracts/src/agent.test.ts`

**Interfaces (Produces, all Zod 4 schemas exported with inferred types of the same name without the `Schema` suffix):**
- `money.ts`: `formatPaypalAmount(cents: number): string` (`8000 → "80.00"`), `parsePaypalAmount(value: string): number` (`"190.00" → 19000`), `applyPercent(cents: number, percent: number): number` (rounds half up to the cent).
- `catalog.ts`: `RuleRefSchema = { id: string; version: number }`; `ruleRefLabel(ref): string` → `"S2.report.v1"`; `PricingRuleSchema = { id, version, type: 'fixed' | 'per_unit' | 'multiplier', label, amountCents?, unit?, percent?, conditions? }`; `ServiceSchema = { id, businessId, name, description, pricingRules: PricingRule[], inclusions: string[], exclusions: string[], deliveryDays }`.
- `scope.ts`: `ScopeClauseSchema = { id: string; text: string; included: boolean; source: { kind: 'contract' } | { kind: 'quote'; quoteId: string; version: number } }`.
- `agent.ts`: `LineItemIntentSchema = { kind: 'included', scopeRef: string, label, rationale } | { kind: 'rule', ref: RuleRef, quantity: number (default 1), params?: Record<string, unknown>, label, rationale }` (discriminated union on `kind`); `AgentOutputSchema = { lineItems: LineItemIntent[], needsInfo: { question: string; whyItChangesPrice: string }[], explanation: string, deliveryDays: number, confidence: number (0..1) }`; `ContextPackSchema = { business: { name: string; currency: 'USD' }; services: Service[]; project: { id: string; title: string; scopeClauses: ScopeClause[] } | null; priorQuotes: { quoteId: string; version: number; status: QuoteStatus; lineItems: QuoteLineItem[] }[]; mandate: { perPurchaseLimitCents: number; remainingCents: number } | null; openQuestions: { quoteId: string; question: string }[] }` (shared by Track A's `AgentPort` and Track B's builder; the `QuoteLineItem` and `QuoteStatus` references point at `quote.ts`, so `agent.ts` imports from it).
- `quote.ts`: `QuoteStatusSchema` enum `draft | needs_info | published | accepted | paid | superseded | expired | rejected`; `QuoteLineItemSchema = LineItemIntent & { unitAmountCents, amountCents, ruleRef?: RuleRef, scopeRef?: string }`; `QuoteSchema = { id, requestId, projectId?, version, status, lineItems, subtotalCents, totalCents, currency: 'USD', explanation, deliveryDays, needsInfo, publishedAt?, acceptedAt?, paidAt? }`.
- `mandate.ts`: `MandateStatusSchema` enum `pending | active | exhausted | expired | revoked`; `MandateSchema = { id, clientId, businessId, projectId, perPurchaseLimitCents, totalLimitCents, spentCents, currency, expiresAt, status, funding: { paypalAuthorizationId?, fundingAmountCents, fundingCapturedCents, fundingExpiresAt? } }`.
- `policy.ts`: `PolicyReasonSchema` enum `mandate_inactive | mandate_expired | wrong_project | currency_mismatch | stale_version | over_per_purchase | over_total | funding_exhausted`; `PolicyDecisionSchema = { outcome: 'allow' } | { outcome: 'needs_approval' | 'deny', reason: PolicyReason, message: string }`.
- `payment.ts`: `PaymentStatusSchema` enum `created | approved | captured | denied | refunded`; `PaymentSchema = { id, quoteId, quoteVersion, mode: 'pay_now' | 'mandate', paypalOrderId?, paypalAuthorizationId?, paypalCaptureId?, amountCents, currency, status, createdAt }`; `AcceptQuoteResultSchema = { status: 'paid' | 'approval_required' | 'denied', reason?: PolicyReason | 'no_mandate', message?: string, approvalUrl?: string, payment?: Payment }`.
- `mcp.ts`: input/output schemas for the eight tools of spec 7.6, built from the above: `RequestQuoteInput = { projectId?: string; text: string (min 1, max 2000) }`, `AnswerQuestionsInput = { quoteId; answers: Record<string, string> }`, `AcceptQuoteInput = { quoteId; version: number }`, etc.

- [ ] **Step 1: Write failing tests** `money.test.ts` (`formatPaypalAmount(8000) === "80.00"`, `formatPaypalAmount(19000) === "190.00"`, `parsePaypalAmount("60.00") === 6000`, `applyPercent(19000, 25) === 4750`) and `agent.test.ts` (parses the fixture `{ lineItems: [{kind:'included', scopeRef:'C1', label:'Per-branch view', rationale:'...'}, {kind:'rule', ref:{id:'S2.report', version:1}, quantity:1, label:'Weekly Monday summary email', rationale:'...'}], needsInfo: [], explanation: '...', deliveryDays: 1, confidence: 0.9 }`; rejects `kind: 'price'`; rejects a `rule` intent carrying `amountCents`, by `.strict()` on the object).
- [ ] **Step 2: Run** `pnpm --filter @dealingwith/contracts test` → FAIL (modules missing).
- [ ] **Step 3: Implement the schemas and helpers** with the exact names above; `index.ts` re-exports everything.
- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck` → clean.
- [ ] **Step 5: Commit** `feat(contracts): shared schemas for catalog, quotes, mandates, policies, payments, MCP` and push.

- Addendum 2026-11-07 (integrator, on `main` after Phase 0): `request.ts` (`RequestSchema`), `access.ts` (`SessionSchema`, `ClientAgentSchema`, `AGENT_SCOPES`, `AgentTokenSchema`, `ConnectionSnippetsSchema`, `IssuedAgentSchema`), `events.ts` (`DomainEventSchema`), `api.ts` (`AppConfigSchema`, `ProjectViewSchema`, `ApiErrorSchema`, dashboard rows, `DashboardDataSchema`); `AcceptQuoteReasonSchema` gained `not_acceptable`; `ContextPackSchema` lives in `context.ts`. Decision: `docs/decisions/2026-11-07-api-shapes-live-in-contracts.md`.

### Task T3: Database schema, client factory, migrations (`apps/backend/src/db`)

**Files:**
- Create: `apps/backend/src/db/schema.ts`, `apps/backend/src/db/client.ts`, `apps/backend/src/db/migrate.ts`, `apps/backend/drizzle.config.ts`, `apps/backend/drizzle/` (generated SQL), `apps/backend/src/db/test-db.ts`
- Test: `apps/backend/src/db/client.test.ts`

**Interfaces:**
- Produces: Drizzle tables exactly as spec 7.1, snake_case columns, `uuid` primary keys with `defaultRandom()`, `timestamptz` timestamps, `jsonb` for `pricing_rules`, `scope_clauses`, `line_items`, `needs_info`, `raw`, `payload`. `quotes` has a composite primary key `(quote_id uuid, version int)`: `quote_id` is the stable identifier clients see (generated at version 1), one row per version. Unique indexes: `payments.idempotency_key`, `webhook_events.paypal_event_id`, `client_agents.token_hash`, `(quotes.request_id, quotes.version)`. `payments` references `(quote_id, quote_version)`. `mandates` has the four funding columns. `requests.status` enum `open | quoted | needs_info | failed`. `agent_runs` as spec.
- `createDb(url: string): Promise<Db>` where `Db = PgDatabase<PgQueryResultHKT, typeof schema>`; `pglite://memory` → in-memory PGlite, `pglite://<dir>` → persisted PGlite, `postgres://...` → `pg` Pool. `runMigrations(db): Promise<void>` applies `apps/backend/drizzle/*.sql` using the matching Drizzle migrator.
- `test-db.ts`: `createTestDb(): Promise<Db>` = in-memory PGlite + migrations, used by every backend test.

- [ ] **Step 1: Write failing test** `client.test.ts`: `createTestDb()` then insert into `businesses` `{ name: 'Andes Data Studio', country: 'CL', currency: 'USD' }` and select it back; asserts `name`. Second test: inserting two `webhook_events` with the same `paypal_event_id` rejects with a unique-violation error.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write `schema.ts`** (ten tables), `drizzle.config.ts` (dialect `postgresql`, schema path, out `./drizzle`), run `pnpm --filter @dealingwith/backend drizzle-kit generate` and commit the SQL.
- [ ] **Step 4: Implement `client.ts` and `migrate.ts`** per the interface. The `postgres://` branch uses `drizzle-orm/node-postgres`; the PGlite branches use `drizzle-orm/pglite`.
- [ ] **Step 5: Run tests** → PASS.
- [ ] **Step 6: Commit** `feat(db): drizzle schema, migrations and PGlite/Postgres client factory` and push.

### Task T4: Demo seed and reset (`apps/backend/src/db/seed.ts`)

**Files:**
- Create: `apps/backend/src/db/seed.ts`, `apps/backend/src/db/demo-data.ts`
- Test: `apps/backend/src/db/seed.test.ts`

**Interfaces:**
- Produces: `DEMO` constant object in `demo-data.ts` with fixed UUIDs (`DEMO.business.id`, `DEMO.services.S1.id` … `S3`, `DEMO.client.id`, `DEMO.project.id`, `DEMO.mandate.id`, `DEMO.owner.email = 'owner@andesdata.example'`, `DEMO.client.email = 'mara@lukasretail.example'`) and the spec section 6 data verbatim: services S1 (`S1.price` v1 fixed 120000, deliveryDays 15), S2 (`S2.report` v1 fixed 8000, `S2.alert` v1 fixed 6000, deliveryDays 1), S3 (`S3.base` v1 fixed 15000, `S3.per_source` v1 per_unit 4000 unit `source`, `S3.rush` v1 multiplier percent 25 conditions "delivery under 48 h"), inclusions and exclusions as listed; project P1 "Retail KPI dashboard" with clauses C1 (included), C2 (excluded), C3 (included) all `source.kind = 'contract'`, `total_contracted = 120000`, contracted 2026-10-20; mandate M1 `pending`, per purchase 10000, total 30000, expires 2026-12-31T23:59:59Z, `fundingAmountCents = 200000`, `fundingCapturedCents = 0`.
- `seedDemo(db: Db): Promise<void>` idempotent (upsert by fixed ids). `resetDemoData(db: Db): Promise<void>` deletes `agent_runs`, `webhook_events`, `payments`, `quotes`, `requests` (never `client_agents`: connected agents survive a reset); restores project clauses to C1–C3; sets mandate `spent_cents = 0` and keeps `paypal_authorization_id`, `funding_amount_cents`, `funding_captured_cents`, `status` (so the funding survives a reset, spec section 6).

- [ ] **Step 1: Write failing tests:** `seedDemo` twice leaves exactly 1 business, 3 services, 1 project with 3 clauses, 1 mandate `pending`; `resetDemoData` after inserting an extra clause and `spent_cents = 6000` restores 3 clauses and `spent_cents = 0` while a previously set `paypal_authorization_id` is unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `demo-data.ts`, `seedDemo`, `resetDemoData`; add `pnpm --filter @dealingwith/backend seed` script (`tsx src/db/seed-cli.ts` reading `DATABASE_URL`).
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `feat(db): idempotent demo seed and reset` and push. Phase 1 tracks may start.

---

## Phase 1 — Track A: commerce core (backend)

Revised 2026-11-07 by the integrator against the Phase 0 code on `main` (commits `2b42f53` … `25699ea`). Written so that a session with no other context (Codex, Claude Code or a human) can execute it task by task.

**What already exists and you build on (read the files, they are short):**

- `packages/contracts/src/*.ts` (`@dealingwith/contracts`): `Service`, `PricingRule` (discriminated union `fixed | per_unit | multiplier`, each with `id`, `version`, `label`), `RuleRef`, `ruleRefLabel`, `ScopeClause`, `Project`, `LineItemIntent` (`included | rule`), `AgentOutput`, `ContextPack`, `Quote` (+ `QuoteLineItem` = intent + `unitAmountCents`, `amountCents`, and `ruleRef` on rule lines), `Mandate` (with `funding` block), `PolicyReason`, `PolicyDecision`, `Payment`, `AcceptQuoteResult`, `AcceptQuoteReason` (`PolicyReason | 'no_mandate' | 'not_acceptable'`), `Request`, `Session`, `ClientAgent`, `AGENT_SCOPES`, `AgentTokenSchema`, `ConnectionSnippets`, `IssuedAgent`, `DomainEvent`, `AppConfig`, `ProjectView`, `ApiError`, `DashboardData` and its row schemas, the MCP tool schemas, and money helpers `formatPaypalAmount`, `parsePaypalAmount`, `applyPercent`.
- `apps/backend/src/db/schema.ts`: eleven Drizzle tables (`businesses`, `services`, `clients`, `projects`, `mandates`, `clientAgents`, `requests`, `quotes` with composite primary key `(quote_id, version)`, `payments` with unique `idempotency_key`, `webhookEvents` with unique `paypal_event_id`, `agentRuns`). Timestamps are `Date` objects (`mode: 'date'`); jsonb columns are typed with the contracts types.
- `apps/backend/src/db/client.ts` (`Db`, `createDb(url)`, `closeDb`), `migrate.ts` (`runMigrations`), `test-db.ts` (`createTestDb()`: in-memory PGlite with migrations), `seed.ts` (`seedDemo(db)`, `resetDemoData(db)`), `demo-data.ts` (`DEMO` with fixed UUIDs: business `…0001`, services S1 `…0011`, S2 `…0012`, S3 `…0013`, client `…0021`, project P1 `…0031`, mandate M1 `…0041`; rule ids `S1.price`, `S2.report` 8000, `S2.alert` 6000, `S3.base` 15000, `S3.per_source` 4000 per `source`, `S3.rush` 25 %; clauses C1 included, C2 excluded, C3 included).
- Tooling: TypeScript `~5.9.3` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; ESM with `.js` extensions in relative imports; Biome (single quotes, semicolons, 100 columns; `pnpm lint:fix` formats); Vitest 5 (`pnpm vitest run <path>` for one file, `pnpm test` for all); CI runs lint, typecheck, test on every push.

**What Track A owns:** everything under `apps/backend/src/` except `db/`, plus `apps/backend/src/agent/port.ts` (placeholder only) and the new `tests/` workspace (A8). Track A never edits `packages/contracts`, `apps/backend/src/db`, or anything under `apps/web`, `apps/backend/src/agent/` (other than `port.ts`), `evals/`. If a contract or schema change seems necessary, write a decision file, build against a local type, and flag it in the report; the integrator lands it.

**Conventions specific to this track (apply in every task):**

- Modules receive `db: Db` (repositories) or `deps: Deps` (workflows) as the first argument. No module-level singletons, no `process.env` reads outside `env.ts`.
- Every row leaving a module is mapped to its contracts type by a `toX(row)` function next to the repository (`toQuote`, `toPayment`, `toMandate`, `toProject`, `toService`, `toRequest`, `toClientAgent`), validated in tests with `XSchema.parse(toX(row))`. Dates become ISO strings; `quotes.quoteId` becomes `Quote.id`; optional fields are omitted when null (never set to `undefined`, because of `exactOptionalPropertyTypes`; use the `compact()` helper from A0).
- Errors thrown to callers are `AppError` (A0) with a stable `code`, an HTTP `status` and a human `message`; PayPal failures are `PaypalError` (A4). No bare `throw new Error` in module code.
- Money is integer cents end to end; `formatPaypalAmount` is used only inside `integrations/paypal`; `formatUsd` (A0) is used for messages people read.
- Tests use `createTestDb()` and `seedDemo(db)`; they never touch `.data/` or the network. One `describe` per exported function, test names in plain English stating the behaviour.
- Dependencies for the track (install in A0 with `pnpm --filter @dealingwith/backend add …`): `hono` (4.13), `@hono/node-server` (2.x; verify the `serve` and `serveStatic` exports against `node_modules/@hono/node-server/dist/index.d.ts` before use), `@hono/zod-validator` (0.9), `zod` (4, same major as contracts). Nothing else without a decision file.

### Task A0: Backend foundations (`env.ts`, `observability/logger.ts`, `lib/`)

**Files:**
- Create: `apps/backend/src/env.ts`, `apps/backend/src/observability/logger.ts`, `apps/backend/src/lib/errors.ts`, `apps/backend/src/lib/serialize.ts`, `apps/backend/src/lib/format.ts`, `apps/backend/src/test/demo.ts`
- Modify: `apps/backend/package.json` (dependencies above; scripts unchanged)
- Test: `apps/backend/src/env.test.ts`, `apps/backend/src/lib/errors.test.ts`, `apps/backend/src/lib/serialize.test.ts`, `apps/backend/src/lib/format.test.ts`

**Interfaces:**
- `env.ts`: `EnvSchema` (Zod) and `loadEnv(source: Record<string, string | undefined> = process.env): Env`. Fields and defaults, exactly: `DATABASE_URL` (default `pglite://.data/dev`), `PAYPAL_MODE: 'mock' | 'sandbox'` (default `mock`), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (optional strings; required when `PAYPAL_MODE=sandbox`, enforced with a Zod `superRefine`), `MOCK_WEBHOOK_SECRET` (default `mock-webhook-secret`), `LLM_PROVIDER: 'anthropic' | 'openai' | 'mock'` (default `mock`), `LLM_MODEL` (optional), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (optional), `APP_URL` (default `http://localhost:3000`, must be a URL without trailing slash), `PORT` (number, default 3000), `SESSION_SECRET` (default `dev-session-secret-change-me`; when `APP_URL` is https the default is rejected), `DEMO_MODE` (boolean from `'true' | 'false'`, default `true`), `WEB_DIST_DIR` (optional path). `loadEnv` throws `AppError('invalid_env', 500)` listing the offending variables. `index.ts` (A7) calls `process.loadEnvFile('.env')` only when the file exists, before `loadEnv()`; tests pass an explicit `source`.
- `logger.ts`: `createLogger(bindings?: Record<string, unknown>): Logger` with `info | warn | error (msg: string, fields?: Record<string, unknown>)` writing one JSON line per call to stdout (`{ level, time, msg, ...bindings, ...fields }`), and `child(bindings)`. `redact(fields)` replaces the values of keys named `token`, `authorization`, `secret`, `password`, `clientSecret`, `apiKey` (case-insensitive) with `"[redacted]"` before writing. A `silent` option for tests.
- `lib/errors.ts`: `class AppError extends Error { readonly code: string; readonly status: number; readonly details?: unknown; constructor(code, message, options?: { status?: number; details?: unknown; cause?: unknown }) }` (status default 400); `isAppError(e): e is AppError`; `notFound(entity: string, id: string): AppError` (404, code `${entity}_not_found`, message `${Entity} ${id} not found`).
- `lib/serialize.ts`: `toIso(date: Date): string`; `toIsoOrUndefined(date: Date | null): string | undefined`; `compact<T extends object>(obj: T): T` removes keys whose value is `undefined` (so contracts objects satisfy `exactOptionalPropertyTypes`).
- `lib/format.ts`: `formatUsd(cents: number): string` → `US$80.00`, `US$1,234.50` (thousands separator, always two decimals; throws `RangeError` on non-integer).
- `test/demo.ts` (test helper, not shipped): `demoServices(): Service[]` (the three `DEMO.services` entries as contracts `Service` objects with `businessId: DEMO.business.id`), `demoClauses(): ScopeClause[]` (P1's C1–C3), `DEMO_IDS` re-exporting the fixed ids. Pure data, no database.

- [ ] **Step 1: Write failing tests:** `loadEnv({})` yields every default above; `loadEnv({ PAYPAL_MODE: 'sandbox' })` throws `invalid_env` naming `PAYPAL_CLIENT_ID`; `loadEnv({ PORT: 'abc' })` throws; `loadEnv({ APP_URL: 'https://x.example' })` throws because of the default session secret. `AppError` keeps `code`, `status`, `details`, `cause`; `notFound('quote', 'q1').status === 404`. `compact({ a: 1, b: undefined })` has no key `b`; `toIso(new Date(0)) === '1970-01-01T00:00:00.000Z'`. `formatUsd(8000) === 'US$80.00'`, `formatUsd(123450) === 'US$1,234.50'`, `formatUsd(0) === 'US$0.00'`, `formatUsd(1.5)` throws.
- [ ] **Step 2: Run** `pnpm vitest run apps/backend/src/env.test.ts apps/backend/src/lib` → FAIL (modules missing). **Step 3: Implement.** **Step 4: Run** → PASS; `pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit** `chore(backend): env, logger, errors and formatting foundations`, push, tick A0 in `docs/milestones.md` (same commit).

### Task A1: Pricing engine (`modules/quotes/pricing.ts`)

**Files:**
- Create: `apps/backend/src/modules/quotes/pricing.ts`, `apps/backend/src/modules/quotes/errors.ts`
- Test: `apps/backend/src/modules/quotes/pricing.test.ts`

**Interfaces:**
- `errors.ts`: `class PricingError extends AppError { code: 'unknown_rule' | 'unknown_scope_ref' | 'excluded_scope_ref'; ref: string }` (status 422). Messages: `Rule "S9.nope" does not exist in the catalog`, `Scope clause "C9" does not exist in this project`, `Scope clause "C2" is excluded from the contracted scope and cannot be marked as included`.
- `pricing.ts`: `type PricedQuote = { lineItems: QuoteLineItem[]; subtotalCents: number; totalCents: number }`; `priceIntents(intents: LineItemIntent[], catalog: { services: Service[]; scopeClauses: ScopeClause[] }): PricedQuote` (pure, synchronous); `resolveRule(services: Service[], ruleId: string): { service: Service; rule: PricingRule } | null` (the **current** rule = the entry with the highest `version` for that `id` across all services; the version the agent asked for is never used for pricing, only reported back through `ruleRef`).
- Pricing rules, exactly:
  1. `included` intent → clause lookup by `scopeRef`: missing → `unknown_scope_ref`; `included: false` → `excluded_scope_ref`; else line `{ ...intent, unitAmountCents: 0, amountCents: 0 }`.
  2. `rule` intent with a `fixed` or `per_unit` rule → `unitAmountCents = rule.amountCents`, `amountCents = unitAmountCents × quantity` (quantity defaults to 1 via the contracts schema), `ruleRef = { id: rule.id, version: rule.version }`.
  3. `rule` intent with a `multiplier` rule → computed after every non-multiplier line: `base = Σ amountCents` of the non-multiplier **rule** lines whose rule belongs to the same service (resolved through `resolveRule`); `amountCents = applyPercent(base, rule.percent)`; `unitAmountCents = amountCents`; `quantity = 1`. Two multipliers on one service each apply to the same base (no compounding). A multiplier with no base lines prices to 0 and is kept.
  4. Unknown rule id → `unknown_rule`. The intent's `params`, `label`, `rationale` are carried through untouched.
  5. `subtotalCents = Σ amountCents` of non-multiplier lines; `totalCents = Σ amountCents` of all lines. Output order = input order.

- [ ] **Step 1: Write failing tests** with `demoServices()` and `demoClauses()`: (a) `included C1` → one line, `amountCents 0`, `totalCents 0`; (b) `rule S2.report v1` → `8000`, `ruleRef { id: 'S2.report', version: 1 }`; (c) `S3.base` + `S3.per_source × 1` → `subtotalCents 19000`, `totalCents 19000`; (d) (c) + `S3.rush` → rush line `4750`, `subtotalCents 19000`, `totalCents 23750`, lines in input order; (e) `rule S2.report v9` → priced `8000` and `ruleRef.version === 1` (Review Focus 1); (f) `rule S9.nope` → throws `PricingError` with `code 'unknown_rule'`, `status 422`; (g) `included C2` → `excluded_scope_ref`; (h) `included C9` → `unknown_scope_ref`; (i) `S3.rush` alone → line `0`, total `0`; (j) `S3.per_source × 3` → `12000`; (k) `S3.rush` twice with `S3.base` → each rush line `3750`, total `22500`; (l) a `rule` intent with `params: { day: 'Monday' }` keeps `params` on the output line; (m) the result passes `QuoteLineItemSchema.array().parse`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(quotes): deterministic pricing engine with rule version resolution`, push, tick A1.

### Task A2: Repositories: catalog, projects, requests, quote versions

**Files:**
- Create: `apps/backend/src/modules/catalog/catalog.ts`, `apps/backend/src/modules/projects/projects.ts`, `apps/backend/src/modules/requests/requests.ts`, `apps/backend/src/modules/quotes/quotes.ts`
- Test: `apps/backend/src/modules/catalog/catalog.test.ts`, `apps/backend/src/modules/projects/projects.test.ts`, `apps/backend/src/modules/requests/requests.test.ts`, `apps/backend/src/modules/quotes/quotes.test.ts`

**Interfaces:**
- `catalog.ts`: `listServices(db, businessId): Promise<Service[]>` (ordered by name); `getService(db, serviceId): Promise<Service>` (`notFound('service', id)`); `toService(row)`.
- `projects.ts`: `getProject(db, projectId): Promise<Project>`; `listProjectsForClient(db, clientId): Promise<Project[]>`; `appendPaidClauses(db, projectId, quote: Quote): Promise<ScopeClause[]>`: in one transaction, lock the project row (`SELECT … FOR UPDATE`), return `[]` without writing if any clause already has `source.kind === 'quote' && source.quoteId === quote.id && source.version === quote.version`; otherwise append one clause per **rule** line of the quote: `id = 'C' + (n + 1)` where `n` is the highest numeric suffix among existing `C{n}` ids, `text = line.label`, `included: true`, `source: { kind: 'quote', quoteId: quote.id, version: quote.version }`; return the appended clauses. `totalContractedCents` is never changed by additionals (revenue is read from `payments`). `toProject(row)`.
- `requests.ts`: `createRequest(db, { clientId, projectId?, channel: RequestChannel, agentId?, text }): Promise<Request>` (status `open`; `text` trimmed, 1..2000 characters, else `AppError('invalid_request', 400)`); `getRequest(db, id)`; `setRequestStatus(db, id, status: RequestStatus)`; `listRequestsForBusiness(db, businessId)` (join clients); `toRequest(row)`.
- `quotes.ts`: `createQuoteVersion(db, input: { requestId; projectId?: string; quoteId?: string; priced: PricedQuote; agentOutput: AgentOutput; status: 'published' | 'needs_info'; agentRunId?: string }): Promise<Quote>`: without `quoteId` → a new quote id (`version 1`); with `quoteId` → `version = max(version) + 1` for that quote id, and every earlier version whose status is `published`, `needs_info` or `accepted` becomes `superseded` (an accepted version with a pending PayPal order may still be captured later, see A5 `markPaid`); `explanation`, `deliveryDays`, `needsInfo` copied from `agentOutput`; `publishedAt = now` only for `published`; `currency 'USD'`. `getQuote(db, quoteId, version?): Promise<Quote>` (latest version when omitted; `notFound('quote', id)`); `listQuoteVersions(db, quoteId): Promise<Quote[]>` (ascending); `getLatestPublishedVersion(db, quoteId): Promise<number | null>`; `listQuotesForProject(db, projectId): Promise<Quote[]>` (every version, newest first); `listQuotesForBusiness(db, businessId)` (join requests → clients); `updateQuoteStatus(db, { quoteId, version, status, acceptedAt?, paidAt? }): Promise<Quote>`; `toQuote(row)` (`id = row.quoteId`; `projectId` omitted when null; `publishedAt`, `acceptedAt`, `paidAt` omitted when null).

- [ ] **Step 1: Write failing tests** against `createTestDb()` + `seedDemo(db)`: `listServices` returns S1, S2, S3 and `ServiceSchema.array().parse` passes; `getService` with a random uuid → `service_not_found` 404. `createRequest` with 2001 characters → `invalid_request`; `toRequest` passes `RequestSchema.parse`. Quotes: v1 `published` then v2 → v1 `superseded`, v2 `published`, same `id`, `getLatestPublishedVersion === 2`; a `needs_info` v1 has no `publishedAt` and `getLatestPublishedVersion === null`; `getQuote(id)` returns the latest version; `toQuote` passes `QuoteSchema.parse`. Projects: `appendPaidClauses` with a quote holding one `included` and one `rule` line (built with `priceIntents`) adds exactly `C4` with `text` = the rule line's label and `source.quoteId`; calling it again adds nothing and the project still has 4 clauses; `totalContractedCents` unchanged; after a reset (`resetDemoData`) the project is back to C1–C3.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(core): catalog, project scope, requests and quote versions`, push, tick A2.

### Task A3: Mandates and policies (`modules/mandates`, `modules/policies`)

**Files:**
- Create: `apps/backend/src/modules/mandates/mandates.ts`, `apps/backend/src/modules/policies/evaluate.ts`, `apps/backend/src/modules/policies/messages.ts`, `apps/backend/src/modules/policies/reserve.ts`
- Test: `apps/backend/src/modules/mandates/mandates.test.ts`, `apps/backend/src/modules/policies/evaluate.test.ts`, `apps/backend/src/modules/policies/messages.test.ts`, `apps/backend/src/modules/policies/reserve.test.ts`

**Interfaces:**
- `mandates.ts`: `getMandate(db, id): Promise<Mandate>`; `findMandateForProject(db, { projectId, clientId }): Promise<Mandate | null>` (newest whose status is not `revoked`); `updateMandate(db, id, patch)` (internal); `toMandate(row)` (`funding: { paypalAuthorizationId?, fundingAmountCents, fundingCapturedCents, fundingExpiresAt? }`); `remainingCents(m: Mandate) = totalLimitCents − spentCents` (floor 0); `fundingHeadroomCents(m) = funding.fundingAmountCents − funding.fundingCapturedCents` (floor 0).
- `evaluate.ts`: `evaluate(input: { mandate: Mandate; quote: Quote; latestPublishedVersion: number | null; now: Date }): PolicyDecision`, pure. Checks in this order, first failure wins:

  | # | Condition | Outcome |
  |---|---|---|
  | 1 | `mandate.status` in `pending`, `expired`, `revoked` (`active` and `exhausted` pass) | `deny mandate_inactive` |
  | 2 | `new Date(mandate.expiresAt) < now` | `deny mandate_expired` |
  | 3 | `quote.projectId !== mandate.projectId` (including no project) | `deny wrong_project` |
  | 4 | `quote.currency !== mandate.currency` | `deny currency_mismatch` |
  | 5 | `latestPublishedVersion === null` or `quote.version !== latestPublishedVersion` | `deny stale_version` |
  | 6 | `quote.totalCents > mandate.perPurchaseLimitCents` | `needs_approval over_per_purchase` |
  | 7 | `mandate.spentCents + quote.totalCents > mandate.totalLimitCents` | `needs_approval over_total` |
  | 8 | `funding.fundingCapturedCents + quote.totalCents > funding.fundingAmountCents` | `needs_approval funding_exhausted` |
  | 9 | otherwise | `allow` |

  Every non-allow decision carries `message = policyMessage(reason, …)`.
- `messages.ts`: `policyMessage(reason: AcceptQuoteReason, ctx: { amountCents: number; mandate?: Mandate; quote?: Quote; latestPublishedVersion?: number | null }): string`. Exact texts (the web and the MCP tool show them verbatim; `formatUsd` for money, dates as `YYYY-MM-DD`):
  - `mandate_inactive` → `The mandate is ${status}; the agent can only pay from an active mandate. Approve this payment in PayPal.`
  - `mandate_expired` → `The mandate expired on ${date}. Approve this payment in PayPal or set a new mandate.`
  - `wrong_project` → `This quote belongs to another project; the mandate covers only its own project.`
  - `currency_mismatch` → `The quote is in ${quoteCurrency}; the mandate pays in ${mandateCurrency}.`
  - `stale_version` → `Quote version ${version} is no longer current; the latest published version is ${latest}.` or, with no published version, `Quote version ${version} cannot be accepted; there is no published version.`
  - `over_per_purchase` → `${amount} exceeds the per-purchase limit of ${limit}. Approve this payment in PayPal.` (e.g. `US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal.`)
  - `over_total` → `${amount} would exceed the remaining mandate budget of ${remaining}. Approve this payment in PayPal.`
  - `funding_exhausted` → `${amount} exceeds the remaining PayPal authorization of ${headroom}. Approve this payment in PayPal or re-authorize the mandate.`
  - `no_mandate` → `No mandate covers this project; approve this payment in PayPal.`
  - `not_acceptable` → `Quote version ${version} is ${status} and cannot be accepted.`
- `reserve.ts`: `reserveSpend(db, { mandateId, quote, now }): Promise<PolicyDecision>`: one `db.transaction`; `SELECT … FOR UPDATE` on the mandate row (Drizzle `.for('update')`); read `getLatestPublishedVersion` inside the transaction; `evaluate(...)` on the locked row; on `allow` update `spent_cents += total`, `funding_captured_cents += total`, `status = 'exhausted'` when the new `spent_cents >= total_limit_cents`, `updated_at = now`; return the decision. `releaseSpend(db, { mandateId, amountCents, now }): Promise<Mandate>`: subtract both counters (floor 0) and set `status = 'active'` when it was `exhausted` and `spent_cents < total_limit_cents`.

- [ ] **Step 1: Write failing tests.** `mandates.test.ts`: `toMandate(seeded M1)` passes `MandateSchema.parse`, `remainingCents === 30000`, `fundingHeadroomCents === 200000`; `findMandateForProject` finds M1 for P1 and `null` for a random project. `evaluate.test.ts`: with M1 as `active` (funding 200000, captured 0) and a published P1 quote: 6000 → `allow`; 19000 → `needs_approval over_per_purchase` with the exact `US$190.00 …` message; spent 25000 + 6000 → `over_total` with `remaining US$50.00`; captured 195000 + 6000 → `funding_exhausted`; version 1 when latest is 2 → `deny stale_version`; latest `null` → `stale_version`; `pending` → `deny mandate_inactive`; `exhausted` with spent 30000 → `over_total` (not `mandate_inactive`); `expiresAt` yesterday → `mandate_expired`; quote of another project → `wrong_project`. `messages.test.ts`: one assertion per reason text above. `reserve.test.ts`: against the seeded M1 set to `active`: two sequential reservations of 6000 with `totalLimitCents 10000` → `allow` then `needs_approval over_total`, row shows `spent_cents 6000`, `funding_captured_cents 6000`; `releaseSpend` 6000 → both back to 0; a reservation that reaches exactly `total_limit_cents` flips `status` to `exhausted`, `releaseSpend` flips it back to `active`; `Promise.all` of two reservations of 6000 against 10000 → exactly one `allow`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(policies): mandate evaluation, verbatim reasons and locked spend reservation`, push, tick A3.

### Task A4: PayPal gateway interface and mock (`integrations/paypal`)

**Files:**
- Create: `apps/backend/src/integrations/paypal/gateway.ts`, `apps/backend/src/integrations/paypal/mock.ts`, `apps/backend/src/integrations/paypal/mock-routes.ts`, `apps/backend/src/integrations/paypal/sandbox.ts` (stub), `apps/backend/src/integrations/paypal/index.ts`
- Test: `apps/backend/src/integrations/paypal/mock.test.ts`, `apps/backend/src/integrations/paypal/mock-routes.test.ts`

**Interfaces:**
- `gateway.ts`:

  ```ts
  type OrderIntent = 'CAPTURE' | 'AUTHORIZE';
  type OrderStatus = 'CREATED' | 'APPROVED' | 'COMPLETED' | 'VOIDED';
  type CaptureResult = { captureId: string; status: 'COMPLETED' | 'PENDING' | 'DECLINED'; amountCents: number; raw: unknown };
  interface PaypalGateway {
    createOrder(i: { intent: OrderIntent; amountCents: number; customId: string; requestId: string; returnUrl: string; cancelUrl: string }): Promise<{ orderId: string; approveUrl: string; raw: unknown }>;
    getOrder(orderId: string): Promise<{ orderId: string; intent: OrderIntent; status: OrderStatus; amountCents: number; customId: string; captureId?: string; authorizationId?: string; raw: unknown }>;
    captureOrder(orderId: string, requestId: string): Promise<CaptureResult>;
    authorizeOrder(orderId: string, requestId: string): Promise<{ authorizationId: string; amountCents: number; expiresAt: string | null; raw: unknown }>;
    captureAuthorization(authorizationId: string, i: { amountCents: number; finalCapture: boolean; requestId: string }): Promise<CaptureResult>;
    verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean>;
  }
  class PaypalError extends AppError { /* code: PayPal issue name, e.g. ORDER_NOT_APPROVED; status 422 for business errors, 502 for transport */ }
  ```

- `mock.ts`: `class MockPaypalGateway implements PaypalGateway`, `new MockPaypalGateway({ appUrl, webhookSecret, deliverWebhook?: (event: MockWebhookEvent, headers: Record<string, string>) => Promise<void>, now?: () => Date })`. Behaviour, exactly:
  - Ids are sequential and readable: `MOCK-ORDER-000001`, `MOCK-AUTH-000001`, `MOCK-CAP-000001`, event ids `WH-mock-000001`.
  - Idempotency: every creating method remembers `requestId → result`; a repeated `requestId` returns the stored result and changes nothing (this is what `PayPal-Request-Id` does in the sandbox).
  - `createOrder` → status `CREATED`, `approveUrl = ${appUrl}/mock-paypal/approve/${orderId}`; `raw` shaped like Orders v2 (`id`, `intent`, `status`, `purchase_units[0].{custom_id, amount:{currency_code:'USD', value}}`, `links[]` with `rel: 'approve'`).
  - `approve(orderId, payerId = 'MOCKPAYER01')` (mock-only method): `CREATED → APPROVED`; emits `CHECKOUT.ORDER.APPROVED` with the order as resource. Unknown id → `PaypalError('RESOURCE_NOT_FOUND', 404)`.
  - `captureOrder`: status `CREATED` → `PaypalError('ORDER_NOT_APPROVED')`; `COMPLETED` → `PaypalError('ORDER_ALREADY_CAPTURED')`; intent `AUTHORIZE` → `PaypalError('ORDER_INTENT_MISMATCH')`; else `COMPLETED`, order → `COMPLETED` with `captureId`; emits `PAYMENT.CAPTURE.COMPLETED` with resource `{ id: captureId, status: 'COMPLETED', amount: { currency_code: 'USD', value }, custom_id, supplementary_data: { related_ids: { order_id } } }`.
  - `authorizeOrder`: requires `APPROVED` and intent `AUTHORIZE` (same error codes); returns `expiresAt: null` (sandbox authorizations do not expire; I1 records the real value); order → `COMPLETED` with `authorizationId`; emits `PAYMENT.AUTHORIZATION.CREATED`.
  - `captureAuthorization`: `amountCents > authorized − alreadyCaptured` → `PaypalError('AUTHORIZATION_AMOUNT_EXCEEDED')`; unknown id → `RESOURCE_NOT_FOUND`; else `COMPLETED`, emits `PAYMENT.CAPTURE.COMPLETED` with `custom_id` of the funding order and `supplementary_data.related_ids: { order_id, authorization_id }`.
  - `verifyWebhookSignature(headers, rawBody)` → `headers['x-mock-signature'] === webhookSecret` (header names compared lower-cased).
  - `emitWebhook(eventType, resource)`: builds `{ id, event_type, create_time, resource_type, resource }` and calls `deliverWebhook(event, { 'content-type': 'application/json', 'x-mock-signature': webhookSecret })`; failures are logged, never thrown. Default `deliverWebhook` POSTs to `${appUrl}/api/webhooks/paypal` with `fetch`. `events(): MockWebhookEvent[]` returns everything emitted (for tests).
- `mock-routes.ts`: `createMockPaypalRoutes(gateway: MockPaypalGateway): Hono`. `GET /mock-paypal/approve/:orderId` → an HTML page titled `Mock PayPal` showing `Approve US$80.00` (via `formatPaypalAmount` → `US$` prefix), the `custom_id`, an **Approve** form (`POST /mock-paypal/approve/:orderId`) and a **Cancel** link; `POST …/approve/:orderId` → `gateway.approve`, then `303` redirect to `${returnUrl}?token=${orderId}&PayerID=MOCKPAYER01` (PayPal's real redirect shape); `GET /mock-paypal/cancel/:orderId` → `303` to `${cancelUrl}?token=${orderId}`; unknown order → `404` page. Mounted by A7 only when `PAYPAL_MODE=mock`.
- `sandbox.ts`: `class SandboxPaypalGateway implements PaypalGateway` whose every method throws `PaypalError('SANDBOX_NOT_IMPLEMENTED', 501)`; Task I1 replaces the bodies.
- `index.ts`: `createPaypalGateway(env: Env, options?: { deliverWebhook?: … }): PaypalGateway` → mock when `PAYPAL_MODE=mock`, sandbox otherwise; re-exports the types.

- [ ] **Step 1: Write failing tests.** `mock.test.ts` (with a `deliverWebhook` spy): create → `approve` → `captureOrder` → `COMPLETED`, `amountCents 8000`, order `COMPLETED`, one `PAYMENT.CAPTURE.COMPLETED` event whose `resource.supplementary_data.related_ids.order_id` is the order; capture before approve → `ORDER_NOT_APPROVED`; capture twice → `ORDER_ALREADY_CAPTURED`; same `requestId` twice on `createOrder` → same `orderId`, one order; AUTHORIZE order → approve → `authorizeOrder` → partial captures 6000 + 6000 against 200000 then 190000 → third throws `AUTHORIZATION_AMOUNT_EXCEEDED` and `events()` holds two capture events with `authorization_id`; `verifyWebhookSignature` true with the secret, false without; a failing `deliverWebhook` does not throw out of `captureOrder`. `mock-routes.test.ts` with `app.request()`: `GET /mock-paypal/approve/<id>` is `200` and contains `US$80.00`; `POST` returns `303` with `location` starting with the order's `returnUrl` and containing `token=<id>`; unknown id → `404`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(paypal): gateway interface, mock implementation and approve page`, push, tick A4.

### Task A5: Payments and workflows (`modules/payments`, `workflows`)

**Files:**
- Create: `apps/backend/src/modules/payments/payments.ts`, `apps/backend/src/workflows/deps.ts`, `apps/backend/src/workflows/events.ts`, `apps/backend/src/workflows/accept-quote.ts`, `apps/backend/src/workflows/capture.ts`, `apps/backend/src/workflows/mandate-funding.ts`, `apps/backend/src/workflows/webhooks.ts`, `apps/backend/src/test/workflow-harness.ts`
- Test: `apps/backend/src/workflows/events.test.ts`, `apps/backend/src/workflows/accept-quote.test.ts`, `apps/backend/src/workflows/capture.test.ts`, `apps/backend/src/workflows/mandate-funding.test.ts`, `apps/backend/src/workflows/webhooks.test.ts`

**Interfaces:**
- `deps.ts`: `type Deps = { db: Db; paypal: PaypalGateway; events: EventBus; env: Env; now: () => Date; logger: Logger; agent: AgentPort }`; `type AgentPort = { buildContextPack(db: Db, input: { clientId: string; projectId?: string }): Promise<ContextPack>; runAgent(deps: Deps, input: { pack: ContextPack; text: string; skill: 'contract-service' | 'analyze-additional' | 'explain-quote'; requestId: string; answers?: Record<string, string> }): Promise<{ output: AgentOutput; runId: string }> }` (`ContextPack`, `AgentOutput` from contracts). Track A reaches the agent only through `deps.agent`; it never imports `apps/backend/src/agent/*` except the placeholder it writes in A7.
- `events.ts`: `type EventBus = { publish(event: DomainEvent): void; subscribe(listener: (event: DomainEvent) => void): () => void }`; `createEventBus(): EventBus` (in-process, listener errors caught and logged); `makeEvent(deps, fields: Omit<DomainEvent, 'id' | 'at'>): DomainEvent` (adds `id = randomUUID()`, `at = toIso(deps.now())`).
- `payments.ts`: `createPayment(db, { quoteId, quoteVersion, mode, amountCents, idempotencyKey, paypalOrderId?, paypalAuthorizationId?, raw? }): Promise<Payment>` with `ON CONFLICT (idempotency_key) DO NOTHING`, then read back the row with that key (so a repeated call returns the existing payment); `getPayment(db, id)`; `findPaymentByOrderId(db, orderId)`; `findPaymentByCaptureId(db, captureId)`; `findPaymentForQuoteVersion(db, { quoteId, version })` (newest); `updatePayment(db, id, patch: { status?; paypalOrderId?; paypalAuthorizationId?; paypalCaptureId?; raw? }): Promise<Payment>`; `listPaymentsForProject(db, projectId)` (join `quotes` on `(quoteId, version)`); `listPaymentsForBusiness(db, businessId)`; `toPayment(row)`.
- `accept-quote.ts`: `acceptQuote(deps, { quoteId, version, actor }): Promise<AcceptQuoteResult>` where `actor = { kind: 'web'; clientId: string } | { kind: 'agent'; agent: ClientAgent }`. Algorithm, in order:
  1. `quote = getQuote(db, quoteId, version)` (404), `request = getRequest(db, quote.requestId)`; the actor must own it: `actor.clientId === request.clientId` (web) or `actor.agent.clientId === request.clientId` and `scopes` includes `quote:accept` (agent); otherwise `AppError('forbidden', 403)`.
  2. `quote.status === 'paid'` → `{ status: 'paid', payment: findPaymentForQuoteVersion(...) ?? undefined }` (idempotent).
  3. `quote.status` in `needs_info`, `draft`, `expired`, `rejected` → `{ status: 'denied', reason: 'not_acceptable', message }`.
  4. `quote.status === 'superseded'` or `getLatestPublishedVersion(quoteId) !== version` and status is not `accepted` → `{ status: 'denied', reason: 'stale_version', message }` (Review Focus 2). A version that is already `accepted` (its PayPal order is pending) may be re-accepted: it returns the existing approval URL (step 8).
  5. `quote.totalCents === 0` → `markPaid(deps, { quoteId, version })` with no payment, then `{ status: 'paid', message: 'Nothing to pay: everything requested is already included in the project scope.' }`.
  6. Agent actor: `mandate = actor.agent.mandateId ? getMandate(...) : findMandateForProject(db, { projectId: quote.projectId, clientId })`; none → step 8 with `reason 'no_mandate'`. Else `decision = reserveSpend(db, { mandateId, quote, now })`: `deny` → `{ status: 'denied', reason, message }` (no payment row); `needs_approval` → step 8 with `reason`, `message`; `allow` → step 7.
  7. Mandate capture: `updateQuoteStatus(... 'accepted', acceptedAt)`; `payment = createPayment({ mode: 'mandate', idempotencyKey: `mandate:${quoteId}:${version}`, paypalAuthorizationId })`; `captureAuthorization(authorizationId, { amountCents, finalCapture: false, requestId: idempotencyKey })`; `COMPLETED` → `markPaid(deps, { paymentId, quoteId, version, captureId, raw })` → `{ status: 'paid', payment }`. On `PaypalError` `AUTHORIZATION_AMOUNT_EXCEEDED` → `releaseSpend`, payment `denied`, `{ status: 'denied', reason: 'funding_exhausted', message }`; on any other `PaypalError` → `releaseSpend`, payment `denied`, rethrow (the API answers 502).
  8. Pay now (web actor, or agent without a usable mandate): `payment = createPayment({ mode: 'pay_now', idempotencyKey: `pay:${quoteId}:${version}`, amountCents })`; if it already has `paypalOrderId`, reuse it and its stored `raw.approveUrl`; else `createOrder({ intent: 'CAPTURE', amountCents, customId: `quote:${quoteId}:${version}`, requestId: idempotencyKey, returnUrl: `${APP_URL}/pay/return`, cancelUrl: `${APP_URL}/pay/cancel` })` and store `paypalOrderId` and `raw.approveUrl`; `updateQuoteStatus(... 'accepted', acceptedAt)` when not yet accepted; publish `payment.approval_required` (with `approvalUrl`, `reason?`, `message?`); return `{ status: 'approval_required', approvalUrl, payment, reason?, message? }`.
- `capture.ts`: `captureApprovedOrder(deps, { orderId }): Promise<Payment>`: `findPaymentByOrderId` (404 `payment_not_found`); `status === 'captured'` → return it unchanged (Review Focus 3); `captureOrder(orderId, payment.idempotencyKey)`: `COMPLETED` → `markPaid`; `PENDING` → payment `approved`, return; `DECLINED` → payment `denied`, return; `PaypalError ORDER_ALREADY_CAPTURED` → `getOrder` and `markPaid` with its `captureId`; `ORDER_NOT_APPROVED` → `AppError('order_not_approved', 409)`. `markPaid(deps, { quoteId, version, paymentId?, captureId?, raw? }): Promise<{ quote: Quote; payment?: Payment; appendedClauses: ScopeClause[] }>` in one transaction: if the quote version is already `paid` → return the current state without writing; else payment (when given) → `captured` with `paypalCaptureId` and `raw`; quote → `paid` with `paidAt` (also when the version is `superseded`: a human approved that exact version in PayPal, so the money and the scope are recorded); `appendPaidClauses` when the quote has a project; after commit publish `quote.paid` with `quote`, `payment`, `project`.
- `mandate-funding.ts`: `createMandate(deps, { clientId, projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }): Promise<Mandate>` (`pending`; `AppError('invalid_mandate', 400)` when `perPurchase > total`, `expiresAt <= now`, or the project is not the client's; `AppError('mandate_exists', 409)` when a non-revoked mandate exists for the project); `updateMandateLimits(deps, { mandateId, perPurchaseLimitCents, totalLimitCents, expiresAt }): Promise<Mandate>` (status unchanged; same validations); `startFunding(deps, { mandateId, fundingAmountCents }): Promise<{ approvalUrl: string; orderId: string }>` → `createOrder({ intent: 'AUTHORIZE', amountCents: fundingAmountCents, customId: `mandate:${mandateId}`, requestId: `fund:${mandateId}:${toIso(now)}`, returnUrl: `${APP_URL}/portal/mandates/${mandateId}/funded`, cancelUrl: `${APP_URL}/portal/projects/${projectId}` })`; `completeFunding(deps, { mandateId, orderId }): Promise<Mandate>` → `getOrder` must have `customId === mandate:${mandateId}` (403 `order_mismatch`), `authorizeOrder(orderId, `authorize:${orderId}`)`, then set `paypalAuthorizationId`, `fundingAmountCents = authorized amount`, `fundingCapturedCents = 0`, `fundingExpiresAt`, `status = 'active'` (from `pending` or `active`; `exhausted` stays `exhausted` because the policy budget, not the funding, is spent), publish `mandate.updated`; `revokeMandate(deps, { mandateId }): Promise<Mandate>` → `revoked`, publish `mandate.updated` (voiding the PayPal authorization is in the roadmap).
- `webhooks.ts`: `processWebhook(deps, { headers: Record<string, string>; rawBody: string }): Promise<{ result: 'processed' | 'duplicate' | 'ignored' | 'invalid_signature' }>`: `verifyWebhookSignature` false → `invalid_signature` (the route answers 400, nothing stored); parse JSON (`id`, `event_type`, `resource`); one transaction: `INSERT INTO webhook_events … ON CONFLICT (paypal_event_id) DO NOTHING RETURNING id` → no row → `duplicate`; else dispatch and store `result` and `processed_at` in the same transaction (an exception rolls the row back so PayPal's retry is processed). Dispatch:
  - `PAYMENT.CAPTURE.COMPLETED`: resolve the payment in this order: `findPaymentByCaptureId(resource.id)`; else `findPaymentByOrderId(resource.supplementary_data.related_ids.order_id)` with `mode pay_now`; else `custom_id` matching `quote:{quoteId}:{version}` → `findPaymentForQuoteVersion`; nothing → `ignored` (Review Focus 4). Found → `markPaid` (no-op when already paid) → `processed`.
  - `CHECKOUT.ORDER.APPROVED`: payment by `resource.id` (order id) with status `created` → `approved`; otherwise `ignored`.
  - `PAYMENT.CAPTURE.DENIED`: payment by capture id or order id → `denied`; `mode mandate` → `releaseSpend`; else `ignored`.
  - `PAYMENT.CAPTURE.REFUNDED`: payment by capture id → `refunded`; else `ignored`.
  - `PAYMENT.AUTHORIZATION.VOIDED`: mandate by `paypalAuthorizationId === resource.id` → `revoked` + `mandate.updated`; else `ignored`.
  - `PAYMENT.AUTHORIZATION.CREATED`: `processed` (record only). Any other type → `ignored`.
- `test/workflow-harness.ts` (test helper): `createHarness(overrides?): Promise<{ deps: Deps; paypal: MockPaypalGateway; events: DomainEvent[]; close(): Promise<void> }>` = `createTestDb()` + `seedDemo` + `MockPaypalGateway` whose `deliverWebhook` calls `processWebhook(deps, …)` in-process + `createEventBus()` recording every event + a fixed `now` + a silent logger + an `agent` that throws (A5 tests never run the agent). Also `publishedQuote(deps, { intents, projectId?, channel? })` creating a request and a published version through A1 and A2 (no agent), and `activateMandate(deps, fundingAmountCents = 200000)` running `startFunding` → mock `approve` → `completeFunding`.

- [ ] **Step 1: Write failing tests** with the harness:
  - `events.test.ts`: `subscribe` receives a published event; the returned function unsubscribes; a throwing listener does not stop the others.
  - `accept-quote.test.ts`: web accept of an 8000 quote → `approval_required`, `approvalUrl` contains `/mock-paypal/approve/`, payment `created` with `idempotencyKey pay:<id>:1`, quote `accepted`, one `payment.approval_required` event; accepting the same version again → same `payment.id` and same `approvalUrl`, still one order in the mock; accept v1 when v2 is published → `denied stale_version` with the message naming version 2 and no payment row; accept a `needs_info` quote → `denied not_acceptable`; web actor of another client → 403; agent accept of 6000 with an activated mandate → `paid`, payment `mode mandate`, mandate `spent_cents 6000`, `funding_captured_cents 6000`, project has a clause C4 with `source.quoteId`, one `quote.paid` event; agent accept of 19000 → `approval_required` with `reason over_per_purchase`, the exact `US$190.00 …` message and an `approvalUrl`, mandate counters unchanged; agent with the seeded `pending` mandate → `denied mandate_inactive`; agent whose client has no mandate → `approval_required` with `reason no_mandate`; agent accept when the mock authorization has only 2000 left → `denied funding_exhausted` and `spent_cents` back to 0; accept of a 0-total quote (one `included` line) → `paid` with no payment row and the "Nothing to pay" message.
  - `capture.test.ts`: web accept → `paypal.approve(orderId)` → `captureApprovedOrder` → payment `captured` with `paypalCaptureId`, quote `paid`, project 4 clauses; calling it again → same payment id, still 4 clauses, one `payments` row; capture of an unapproved order → `order_not_approved` 409; a mock whose `captureOrder` throws `ORDER_ALREADY_CAPTURED` → still ends `captured` through `getOrder`.
  - `webhooks.test.ts`: bad signature → `invalid_signature` and no `webhook_events` row; a `PAYMENT.CAPTURE.COMPLETED` built from the mock for a known approved order → `processed`, quote `paid`, row `result 'processed'`; the same event id again → `duplicate`, still one payment and 4 clauses; a valid event for an unknown order → `ignored` and a row with `result 'ignored'` and nothing else changed; `PAYMENT.AUTHORIZATION.VOIDED` for the active mandate → mandate `revoked`; `CHECKOUT.ORDER.APPROVED` → payment `approved`.
  - `mandate-funding.test.ts`: `createMandate` with per-purchase above total → `invalid_mandate`; second mandate for P1 → `mandate_exists` 409; `startFunding` → `completeFunding` on the seeded M1 → `active`, `paypalAuthorizationId` set, `fundingHeadroomCents === 200000`, one `mandate.updated` event; `completeFunding` with an order of another mandate → `order_mismatch` 403; `revokeMandate` → `revoked`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(payments): accept-quote, capture, mandate funding and webhook workflows`, push, tick A5.

### Task A6: Access: demo sessions and agent tokens (`access`)

**Files:**
- Create: `apps/backend/src/access/session.ts`, `apps/backend/src/access/agent-tokens.ts`, `apps/backend/src/access/snippets.ts`
- Test: `apps/backend/src/access/session.test.ts`, `apps/backend/src/access/agent-tokens.test.ts`, `apps/backend/src/access/snippets.test.ts`

**Interfaces:**
- `session.ts`: `Session` is the contracts type. `signSession(session: Session, secret: string, options: { now: Date; ttlSeconds?: number }): string` → `base64url(JSON{ ...session, exp })` + `.` + `base64url(HMAC-SHA256(payload, secret))`, default TTL 86400 s; `verifySession(token: string, secret: string, now: Date): Session | null` (null on bad shape, bad signature (constant-time compare), expired, or payload failing `SessionSchema`); `SESSION_COOKIE = 'dw_session'`; `sessionCookieHeader(token, { secure: boolean }): string` → `dw_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` plus `; Secure` when `secure`; `clearSessionCookieHeader()`.
- `agent-tokens.ts`: `issueAgentToken(db, { clientId, label, mandateId? }): Promise<{ token: string; agent: ClientAgent }>` → token `dwa_` + 32 random bytes base64url (matches `AGENT_TOKEN_PATTERN`), stored as SHA-256 hex in `token_hash`, `scopes = [...AGENT_SCOPES]`; `authenticateAgentToken(db, token: string): Promise<ClientAgent | null>` → null when the token fails `AGENT_TOKEN_PATTERN`, is unknown or has `revoked_at`; on success sets `last_used_at = now`; `revokeAgentToken(db, { agentId, clientId }): Promise<ClientAgent>` (404 when not the client's); `listAgents(db, clientId): Promise<ClientAgent[]>` (revoked ones included, newest first); `toClientAgent(row)` (never exposes `token_hash`).
- `snippets.ts`: `connectionSnippets({ appUrl, token }): ConnectionSnippets`, exact strings:
  - `claudeDesktop`: `${appUrl}/mcp/${token}` followed by a newline and `Add this URL as a custom connector in Claude Desktop (Settings → Connectors → Add custom connector). Treat it as a secret: anyone with the link can act as your agent.`
  - `claudeCode`: `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`
  - `cursor`: `JSON.stringify({ mcpServers: { dealingwith: { url: `${appUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)`
  Task C2 verifies these against the clients' current docs and edits the strings if needed.

- [ ] **Step 1: Write failing tests:** `verifySession(signSession(s, secret, { now }), secret, now)` round-trips a client and a provider session; a flipped character in the signature → null; another secret → null; `now` past `exp` → null; a payload with `role: 'admin'` → null; the cookie header contains `HttpOnly`, `SameSite=Lax` and `Secure` only when asked. Tokens: `issueAgentToken` returns a token matching `AGENT_TOKEN_PATTERN`, the row stores a 64-hex hash and not the token, `agent` passes `ClientAgentSchema.parse`; `authenticateAgentToken` with the token → the agent and `lastUsedAt` set; tampered token → null; revoked → null; `revokeAgentToken` by another client → 404; `listAgents` shows the revoked one with `revokedAt`. Snippets: the three strings above, byte for byte, for `appUrl 'http://localhost:3000'` and a fixed token; result passes `ConnectionSnippetsSchema.parse`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(access): signed demo sessions, hashed agent tokens and connection snippets`, push, tick A6.

### Task A7: HTTP API, SSE, static serving, app entry (`api`, `index.ts`)

**Files:**
- Create: `apps/backend/src/workflows/submit-request.ts`, `apps/backend/src/workflows/fake-agent.ts`, `apps/backend/src/workflows/demo-agent-outputs.ts`, `apps/backend/src/agent/port.ts` (placeholder), `apps/backend/src/modules/dashboard/dashboard.ts`, `apps/backend/src/api/app.ts`, `apps/backend/src/api/auth.ts`, `apps/backend/src/api/errors.ts`, `apps/backend/src/api/validate.ts`, `apps/backend/src/api/static.ts`, `apps/backend/src/api/routes/session.ts`, `apps/backend/src/api/routes/config.ts`, `apps/backend/src/api/routes/catalog.ts`, `apps/backend/src/api/routes/projects.ts`, `apps/backend/src/api/routes/requests.ts`, `apps/backend/src/api/routes/quotes.ts`, `apps/backend/src/api/routes/payments.ts`, `apps/backend/src/api/routes/mandates.ts`, `apps/backend/src/api/routes/agents.ts`, `apps/backend/src/api/routes/events.ts`, `apps/backend/src/api/routes/dashboard.ts`, `apps/backend/src/api/routes/demo.ts`, `apps/backend/src/api/routes/webhooks.ts`
- Modify: `apps/backend/src/index.ts` (replace the placeholder)
- Test: `apps/backend/src/workflows/submit-request.test.ts`, `apps/backend/src/modules/dashboard/dashboard.test.ts`, `apps/backend/src/api/app.test.ts`

**Interfaces:**
- `submit-request.ts`: `submitRequest(deps, input: { clientId: string; projectId?: string; channel: RequestChannel; agentId?: string; text: string } | { quoteId: string; answers: Record<string, string>; clientId: string; channel: RequestChannel; agentId?: string }): Promise<Quote>`. New request: `createRequest` → `deps.agent.buildContextPack(db, { clientId, projectId })` → `deps.agent.runAgent(deps, { pack, text, skill: projectId ? 'analyze-additional' : 'contract-service', requestId })` → `priceIntents(output.lineItems, { services: pack.services, scopeClauses: pack.project?.scopeClauses ?? [] })` → `createQuoteVersion({ status: output.needsInfo.length > 0 ? 'needs_info' : 'published', agentRunId: runId })` → `setRequestStatus('quoted' | 'needs_info')` → publish `quote.published` or `quote.needs_info` → return the quote. Answers: load the latest version of `quoteId` (owner check as in `acceptQuote`), reuse its request and text, pass `answers`, create the next version with the same `quoteId`. `PricingError` → request `failed`, rethrown (route answers 422 `invalid_agent_output` with the engine message in `details`). Any other agent failure → request `failed`, `AppError('agent_failed', 502)`.
- `demo-agent-outputs.ts`: `DEMO_AGENT_OUTPUTS: Record<string, AgentOutput>` keyed by a substring of each demo request (spec section 6), exactly these five:

  | Key (substring) | `lineItems` | `needsInfo` | `deliveryDays` |
  |---|---|---|---|
  | `summary email every Monday` | `included C1` label `Per-branch view`; `rule S2.report v1 ×1` label `Weekly Monday summary email` | `[]` | 1 |
  | `Amazon sales as a second source` | `rule S3.base v1 ×1` label `Data source integration: Amazon`; `rule S3.per_source v1 ×1` label `Additional data source: Amazon` | `[]` | 5 |
  | `daily sales drop more than 20%` | `rule S2.alert v1 ×1` label `Daily sales drop alert (20%)` | `[]` | 1 |
  | `regional managers too` | `included C4` label `Monday summary to regional managers` | `[]` | 0 |
  | `load faster` | `[]` | one item: `question: 'Is the slowness caused by data volume or by the dashboard design?'`, `whyItChangesPrice: 'More data means a data source integration; a redesign means a new dashboard build.'` | 0 |

  Each line carries a one-sentence `rationale` citing the clause or rule (e.g. `Covered by clause C1: five views including a per-branch view.`, `Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1.`); `explanation` is one or two sentences for the client; `confidence` 0.9, except 0.4 for the `needs_info` case. These texts are the mock provider's truth for Track B's fixtures too; keep them in this one file.
- `fake-agent.ts`: `fakeAgentPort(outputs: Record<string, AgentOutput> = DEMO_AGENT_OUTPUTS): AgentPort`: `buildContextPack(db, …)` reads the real catalog, project, prior quotes and mandate through A2 and A3 (so `pack.project.scopeClauses` includes paid additionals) and validates with `ContextPackSchema.parse`; `runAgent(deps, …)` picks the first output whose key is a case-insensitive substring of `text` (or of the joined `answers` values when present), inserts an `agent_runs` row through `deps.db` (`provider 'mock'`, `model 'demo-fixtures'`, `promptVersion 'fixtures-v1'`, `outcome 'ok'`, zero tokens) and returns `{ output, runId }`; no match → `AppError('no_fixture_for_request', 422)`.
- `apps/backend/src/agent/port.ts` (placeholder): `export function createAgentPort(env: Env): AgentPort { return fakeAgentPort(); }` (same signature Track B ships) with a header comment stating that Track B replaces this file. Write `docs/decisions/<date>-agent-port-placeholder.md`.
- `dashboard.ts`: `buildDashboardData(db, businessId, now): Promise<DashboardData>` — flattens quotes, lines (one per quote line; `serviceName` = the service owning the line's rule, or the project's service for included lines; `ruleId` null for included), payments, requests; `services` from the catalog; `mandate` = M1's current state (`findMandateForProject` for the single demo project, null when none). Validated with `DashboardDataSchema.parse` before returning.
- `api/auth.ts`: `readSession(c, env): Session | null` from the cookie; `requireSession(role?: 'client' | 'provider')` Hono middleware → 401 `unauthenticated` without a valid cookie, 403 `forbidden` on role mismatch; sets `c.var.session`. `requireClientOwnsProject(db)` helper for `/projects/:id`, `/quotes/:id`.
- `api/errors.ts`: `onError` handler mapping `ZodError` → 400 `validation_error` (`details = z.flattenError(err)`), `AppError` → its status and code, `PaypalError` → its status (502 for transport) with code `paypal_error` and the PayPal issue name in `details`, anything else → 500 `internal_error` (logged with the stack, message hidden). Response body always `ApiError`.
- `api/validate.ts`: `jsonBody(schema)` and `query(schema)` wrappers around `@hono/zod-validator` whose failure hook returns the `ApiError` envelope instead of Hono's default.
- `api/static.ts`: `mountStatic(app, dir)` with `serveStatic` from `@hono/node-server/serve-static` for every non-`/api`, non-`/mcp`, non-`/mock-paypal`, non-`/healthz` path, SPA fallback to `index.html`, 404 JSON when `dir` does not exist (web not built yet). Default `dir = env.WEB_DIST_DIR ?? fileURLToPath(new URL('../../../web/dist', import.meta.url))` (same depth from `src/api/` and from `dist/api/`).
- `app.ts`: `createApp(deps): Hono`. Routes (JSON unless noted; bodies validated with contracts schemas; `S` = client or provider session, `C` = client session, `P` = provider session, `—` = public):

  | Method and path | Auth | Body → Response |
  |---|---|---|
  | `GET /healthz` | — | `{ ok: true }` |
  | `GET /api/config` | — | `AppConfig` |
  | `POST /api/session/login` | — (demo mode only, else 404) | `{ role: 'client' \| 'provider' }` → sets cookie, `Session` (client = `DEMO.client`, provider = `DEMO.business`) |
  | `POST /api/session/logout` | — | clears cookie, `{ ok: true }` |
  | `GET /api/me` | S | `Session` |
  | `GET /api/services` | — | `Service[]` |
  | `GET /api/projects/:id` | C owning it, or P | `ProjectView` |
  | `POST /api/projects/:id/requests` | C owning it | `{ text }` → `Quote` (200) |
  | `POST /api/requests` | C | `{ text }` → `Quote` (storefront, no project) |
  | `GET /api/quotes/:id` | C owning it, or P | `Quote` (latest; `?version=` for one) |
  | `GET /api/quotes/:id/versions` | C owning it, or P | `Quote[]` |
  | `POST /api/quotes/:id/answers` | C owning it | `{ answers: Record<string,string> }` → `Quote` |
  | `POST /api/quotes/:id/accept` | C owning it | `{ version }` → `AcceptQuoteResult` (`actor { kind: 'web', clientId }`) |
  | `POST /api/paypal/orders/:orderId/capture` | C owning the payment's quote | → `Payment` |
  | `GET /api/payments/:id` | C owning it, or P | `Payment` |
  | `POST /api/mandates` | C | `{ projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }` → `Mandate` (201) |
  | `PATCH /api/mandates/:id` | C owning it | `{ perPurchaseLimitCents, totalLimitCents, expiresAt }` → `Mandate` |
  | `POST /api/mandates/:id/fund` | C owning it | `{ fundingAmountCents }` → `{ approvalUrl, orderId }` |
  | `POST /api/mandates/:id/fund/complete` | C owning it | `{ orderId }` → `Mandate` |
  | `POST /api/mandates/:id/revoke` | C owning it | → `Mandate` |
  | `GET /api/agents` | C | `ClientAgent[]` |
  | `POST /api/agents` | C | `{ label, mandateId? }` → `IssuedAgent` (201; the token appears only here) |
  | `DELETE /api/agents/:id` | C owning it | → `ClientAgent` (revoked) |
  | `GET /api/events?projectId=` | C owning it, or P | SSE (`text/event-stream`) of `DomainEvent`s whose `projectId` matches (P without `projectId` gets all); `id` = event id, `event` = type, `data` = JSON; a `: heartbeat` comment every 25 s; unsubscribe on abort (Hono `streamSSE`) |
  | `GET /api/dashboard/data` | P | `DashboardData` |
  | `POST /api/demo/reset` | P (demo mode only) | → `{ ok: true }` after `resetDemoData` |
  | `POST /api/webhooks/paypal` | — (signature) | raw body → `{ result }`; 200 for `processed`, `duplicate`, `ignored`; 400 for `invalid_signature` |
  | `/mock-paypal/*` | — | A4 routes, mounted only when `PAYPAL_MODE=mock` |
  | everything else | — | static web with SPA fallback |

  Request logging middleware: one JSON line per request (`method`, `path`, `status`, `durationMs`, `requestId` from `x-request-id` or a new uuid, echoed back in the response header), through the A0 logger with redaction.
- `index.ts`: `process.loadEnvFile('.env')` if the file exists → `loadEnv()` → `createDb(DATABASE_URL)` → `runMigrations` → `seedDemo` when `DEMO_MODE` → `deps` (`createPaypalGateway(env, { deliverWebhook })` where `deliverWebhook` calls `processWebhook(deps, …)` in-process; `createEventBus()`; `createAgentPort(env)` from `./agent/port.js`; `now = () => new Date()`; logger) → `createApp(deps)` → `serve({ fetch: app.fetch, port })` → log `server.listening` with `appUrl`; on `SIGTERM`/`SIGINT` close the server and `closeDb`.

- [ ] **Step 1: Write failing tests.** `submit-request.test.ts` (harness with `fakeAgentPort`): demo request 1 on P1 → `published`, `totalCents 8000`, two lines, request `quoted`, one `quote.published` event, one `agent_runs` row; request 5 → `needs_info`, request `needs_info`, one `quote.needs_info` event; an output citing `S9.nope` (custom fake) → `PricingError` and request `failed`; answers on the `needs_info` quote with a fake keyed on the answer text → version 2 with the same `id`. `dashboard.test.ts`: after request 1 is paid through the harness, `buildDashboardData` has one paid quote row, one line row with `serviceName 'Automations'`, `ruleId 'S2.report'`, `amountCents 8000`, one payment row `captured`, and passes `DashboardDataSchema.parse`. `app.test.ts` with `app.request()`: `GET /healthz` → 200; `GET /api/config` → `paypalMode 'mock'`; `POST /api/session/login { role: 'client' }` → `set-cookie` with `dw_session` and `HttpOnly`; `GET /api/projects/:id` without cookie → 401 `unauthenticated`; with the client cookie → `ProjectView` with 3 clauses and `mandate.status 'pending'`; `POST /api/projects/:id/requests` with demo request 1 → 200 `Quote` `published` `totalCents 8000`; `{ text: '' }` → 400 `validation_error`; `POST /api/quotes/:id/accept { version: 1 }` → `approval_required` with `approvalUrl`; `GET /mock-paypal/approve/<orderId>` → 200; `POST /api/paypal/orders/:orderId/capture` after `paypal.approve` → `Payment` `captured`, then `GET /api/projects/:id` shows 4 clauses and the quote `paid`; `POST /api/agents { label }` → 201 with a `dwa_` token and three snippets, and `GET /api/agents` lists it without the token; `POST /api/webhooks/paypal` with a bad signature → 400; `GET /api/dashboard/data` as client → 403, as provider → 200; `POST /api/demo/reset` as provider → 200 and the project is back to 3 clauses; `GET /api/events?projectId=` as client → `content-type` `text/event-stream` (read the first chunk after publishing an event, then abort).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; then `pnpm --filter @dealingwith/backend dev` and `curl http://localhost:3000/healthz` → `{"ok":true}`; stop it.
- [ ] **Step 5: Commit** `feat(api): HTTP API, SSE events, static serving and app entry`, push, tick A7.

### Task A8: Scenario tests (`tests/scenarios`)

The five scenarios of spec section 7.8 as readable end-to-end tests that a judge can open and run: fixed agent outputs, real engine, policies, payments and API.

**Files:**
- Create: `tests/package.json` (`"name": "@dealingwith/scenarios"`, private, `devDependencies`: `@dealingwith/contracts: workspace:*`, `vitest`, `typescript ~5.9.3`; scripts `typecheck: tsc --noEmit -p tsconfig.json`), `tests/tsconfig.json` (extends `../tsconfig.base.json`, `include: ["scenarios"]`, `noEmit`), `tests/vitest.config.ts` (`test.include: ['scenarios/**/*.test.ts']`), `tests/scenarios/README.md` (one paragraph: what the five scenarios prove and how to run them), `tests/scenarios/helpers.ts`, `tests/scenarios/01-already-included.test.ts`, `tests/scenarios/02-needs-info.test.ts`, `tests/scenarios/03-mcp-then-web.test.ts`, `tests/scenarios/04-payment-pending.test.ts`, `tests/scenarios/05-duplicates.test.ts`
- Modify: `pnpm-workspace.yaml` (add `- tests`), root `vitest.config.ts` (`projects: ['packages/*', 'apps/*', 'tests']`)

**Interfaces:**
- `helpers.ts`: `createScenario(): Promise<{ app: Hono; deps: Deps; paypal: MockPaypalGateway; cookies: { client: string; provider: string }; request(path, init?, as?: 'client' | 'provider'): Promise<Response>; close(): Promise<void> }>` built from `createHarness` (A5) with `fakeAgentPort()` and `createApp(deps)`; cookies obtained through `POST /api/session/login`. Backend code is imported by relative path (`../../apps/backend/src/...`); the five tests use only the HTTP API plus `deps.paypal.approve` and `deps.db` for assertions.
- Scenarios, each one file, each with the spec's expectation in its `test` name:
  1. **Already included:** request 1 → accept → approve → capture (paid); then request 4 → one `included` line citing `C4`, `totalCents 0`; accept → `status 'paid'`, no new `payments` row (count stays 1), project still 4 clauses.
  2. **Information missing changes the price:** request 5 → `needs_info` with the question; `publishedAt` absent; `GET /api/quotes/:id/versions` has one version; accept → `denied not_acceptable`; project unchanged.
  3. **Starts via MCP, continues on web:** issue a token (`POST /api/agents`), run `submitRequest(deps, { channel: 'mcp', agentId, text: request 3 })`, then `GET /api/quotes/:id` as the web client → same `id`, `version`, `lineItems` and `totalCents 6000`.
  4. **Payment pending:** request 1 → accept → `approval_required`; quote `accepted`, not `paid`; `ProjectView.payments[0].status 'created'`; clauses still 3; `GET /mock-paypal/approve/:orderId` renders (nobody approves).
  5. **Duplicate webhook or duplicate accept:** request 1 → accept twice (same `payment.id`, one mock order) → approve → capture twice (same payment, `captured`) → the mock's `PAYMENT.CAPTURE.COMPLETED` delivered again by hand through `POST /api/webhooks/paypal` → `duplicate`; exactly one `payments` row, exactly one clause C4, `webhook_events` has one row per distinct event id.

- [ ] **Step 1: Write the five tests** (they fail until `helpers.ts` exists). **Step 2: Run** `pnpm vitest run tests` → FAIL. **Step 3: Implement** `helpers.ts`, workspace and config changes; `pnpm install`. **Step 4: Run** `pnpm test` from the root → every project green, including `tests`; `pnpm typecheck` includes `@dealingwith/scenarios`.
- [ ] **Step 5: Commit** `test(scenarios): the five spec scenarios end to end against the API`, push, tick A8. Report the track as done with the full `pnpm lint && pnpm typecheck && pnpm test` output tail.

---

## Phase 1 — Track B: agent

Revised 2026-11-07 by the integrator: the agent lives in `apps/backend/src/agent/` because `apps/backend/tsconfig.build.json` has `rootDir: "src"` (anything outside `src` fails the production build and is skipped by `pnpm typecheck`). Prompts are Markdown files loaded at runtime relative to `import.meta.url`; since `tsc` copies no `.md`, Task B2 adds `apps/backend/scripts/copy-prompts.mjs` to the backend `build` script so `dist/agent/` carries them. `evals/` is a workspace package (`@dealingwith/evals`) like `tests/`: Task B3 adds `- evals` to `pnpm-workspace.yaml` and `'evals'` to the root Vitest projects (a planned one-line overlap with A8 that the integrator resolves). Decision: `docs/decisions/2026-11-07-agent-under-src.md`.

### Task B1: Context pack (`agent/context`)

**Files:**
- Create: `apps/backend/src/agent/context/build.ts`, `apps/backend/src/agent/context/render.ts`
- Test: `apps/backend/src/agent/context/build.test.ts`

**Interfaces:**
- Produces: `buildContextPack(db, { clientId, projectId?: string }): Promise<ContextPack>` (`ContextPack` is the contracts type from T2, validated with `ContextPackSchema.parse` before returning); `renderContextPack(pack): string` — Markdown with every id visible (`[C1] included — five views including a per-branch view`, `[S2.report.v1] fixed US$80.00 — scheduled report email`), so the model can cite them.

- [ ] **Step 1: Write failing tests:** pack for P1 has 3 services, 3 clauses, `mandate` present; after `appendPaidClauses` for a paid quote, the pack has 4 clauses and the fourth has `source.kind 'quote'`; `renderContextPack` output contains `[C1]` and `[S2.report.v1]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): context pack with source references` and push.

### Task B2: LLM provider switch and agent run (`agent/`)

**Files:**
- Create: `apps/backend/src/agent/instructions.md`, `apps/backend/src/agent/skills/contract-service.md`, `apps/backend/src/agent/skills/analyze-additional.md`, `apps/backend/src/agent/skills/explain-quote.md`, `apps/backend/src/agent/prompts.ts` (loads the Markdown files), `apps/backend/src/agent/provider.ts`, `apps/backend/src/agent/run.ts`, `apps/backend/src/agent/port.ts`, `apps/backend/src/agent/mock-fixtures.ts`, `apps/backend/scripts/copy-prompts.mjs`, `evals/scenarios/fixtures/*.json`
- Modify: `apps/backend/package.json` (dependencies `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`; `build` runs `tsc -p tsconfig.build.json && node scripts/copy-prompts.mjs`)
- Test: `apps/backend/src/agent/run.test.ts`, `apps/backend/src/agent/provider.test.ts`

**Interfaces:**
- Produces: `getModel(env): LanguageModel` — `anthropic` → `createAnthropic({ apiKey })(env.LLM_MODEL ?? 'claude-opus-5-5')`; `openai` → `createOpenAI({ apiKey })(env.LLM_MODEL ?? 'gpt-5')`; `mock` → `MockLanguageModel` (from `ai/test`, or a `MockLanguageModelV3`-style stub per the installed `ai@7` types) that returns the fixture whose `match` regex matches the request text. Verify exact import names against the installed `ai`, `@ai-sdk/anthropic` and `@ai-sdk/openai` type declarations before writing; do not use the `"anthropic/model"` gateway string form (it needs a Vercel gateway key).
- `apps/backend/src/agent/port.ts`: `createAgentPort(env): AgentPort` returning `{ buildContextPack, runAgent }` (the `AgentPort` type comes from Track A's `workflows/deps.ts`; Track A ships a placeholder `agent/port.ts` with the same export that the integrator replaces with this one at merge). `runAgent(deps, { pack: ContextPack; text: string; skill: 'contract-service' | 'analyze-additional' | 'explain-quote'; requestId; answers?: Record<string, string> }): Promise<{ output: AgentOutput; runId: string }>` — `generateText({ model, system: instructions + skill file, prompt: renderContextPack(pack) + request (+ answers), output: Output.object({ schema: AgentOutputSchema }) })`; one retry on schema failure; inserts `agent_runs` (`provider`, `model`, `prompt_version` = git short SHA or `'dev'`, tokens, latency, `outcome: 'ok' | 'invalid_output' | 'error'`).
- Fixtures `evals/scenarios/fixtures/`: `01-web-monday-summary.json` (included C1 + rule S2.report), `02-agent-amazon-source.json` (S3.base + S3.per_source ×1), `03-agent-sales-drop-alert.json` (S2.alert), `04-already-covered.json` (included C4), `05-needs-info.json` (`needsInfo` with the data-volume question, empty `lineItems`). Each `{ match: string; output: AgentOutput }`. The `output` objects must equal, field by field, the five rows of the table in Task A7 (`demo-agent-outputs.ts`): same keys, labels, rationales, `deliveryDays`, `confidence`. Both tracks write them from that table; at merge the integrator makes `mock-fixtures.ts` the single source and `demo-agent-outputs.ts` re-export it.
- `instructions.md` (English): role, "classify every need as included or extra against the scope clauses, contract clauses and paid additionals alike", "ask when information changes the price", "never invent services, rules or prices; amounts are computed by the system", "cite the clause id or rule id for every line", output format note.

- [ ] **Step 1: Write failing tests:** `provider.test.ts`: `getModel({ LLM_PROVIDER: 'mock' })` returns a model; `anthropic` without key throws "ANTHROPIC_API_KEY is required"; `openai` likewise. `run.test.ts` (mock): request 1 text → output with `included C1` and `rule S2.report`; request 5 text → `needsInfo.length === 1`; an `agent_runs` row exists with `outcome 'ok'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): provider switch (anthropic, openai, mock), instructions, skills and structured run` and push.

### Task B3: Live eval and graders (`evals/`)

**Files:**
- Create: `evals/package.json` (`@dealingwith/evals`, private; devDependencies `@dealingwith/contracts: workspace:*`, `tsx`, `vitest`, `typescript ~5.9.3`), `evals/tsconfig.json`, `evals/vitest.config.ts`, `evals/live/run.ts`, `evals/graders/classification.ts`, `evals/README.md`
- Modify: `pnpm-workspace.yaml` (add `- evals`), root `vitest.config.ts` (add `'evals'` to `projects`), root `package.json` (script `eval:live`: `pnpm --filter @dealingwith/evals exec tsx --conditions=development live/run.ts`)

**Interfaces:**
- Produces: `gradeClassification(output: AgentOutput, expected: { included: string[]; rules: string[]; needsInfo: boolean }): { pass: boolean; missing: string[]; extra: string[] }`; `evals/live/run.ts` loads `.env`, builds the pack for P1 on a fresh PGlite seed, runs the five demo requests with the real provider, prints a table (request, pass, rule refs, latency, tokens) and exits 1 on any failure. Not in CI.

- [ ] **Step 1: Write failing test** `evals/graders/classification.test.ts`: fixture 1 vs expected `{ included: ['C1'], rules: ['S2.report'], needsInfo: false }` → pass; fixture 3 vs expected rules `['S2.report']` → fail with `missing ['S2.report']`, `extra ['S2.alert']`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement grader and runner.** **Step 4: Run** → PASS; `pnpm eval:live` with `LLM_PROVIDER=mock` prints 5 passes.
- [ ] **Step 5: Commit** `feat(evals): classification grader and live eval runner` and push.

---

## Phase 1 — Track C: MCP server (starts after A5 and A6)

### Task C1: MCP server and routes (`src/mcp`)

**Files:**
- Create: `apps/backend/src/mcp/server.ts`, `apps/backend/src/mcp/tools.ts`, `apps/backend/src/mcp/resources.ts`, `apps/backend/src/mcp/routes.ts`, `apps/backend/src/mcp/format.ts`
- Modify: `apps/backend/src/api/app.ts` (mount `/mcp` and `/mcp/:token`)
- Test: `apps/backend/src/mcp/server.test.ts`

**Interfaces:**
- Consumes: A5 workflows (`acceptQuote(deps, { quoteId, version, actor: { kind: 'agent', agent } })` with the authenticated `ClientAgent`), A6 `authenticateAgentToken`, A2 repositories, A7 `submitRequest(deps, { clientId: agent.clientId, projectId?, channel: 'mcp', agentId: agent.id, text })` from `workflows/submit-request.ts`, A7 `fakeAgentPort()` and `DEMO_AGENT_OUTPUTS` for tests.
- Produces: `createMcpServer(deps, agent: ClientAgent): McpServer` (`@modelcontextprotocol/sdk/server/mcp.js`, name `dealingwith-agent`, version from package). Tools registered with `registerTool(name, { title, description, inputSchema, outputSchema }, handler)` using the contracts `mcp.ts` schemas; each handler returns `{ content: [{ type: 'text', text }], structuredContent }` where `text = formatQuoteMarkdown(quote)` etc. Tools: `list_services`, `get_project`, `request_quote`, `answer_questions`, `get_quote`, `accept_quote`, `get_payment`, `get_mandate`. `accept_quote` description (verbatim): "Accept a quote version. If the client has an active mandate and the amount is within its limits, the payment is captured immediately with PayPal and the response has status "paid". Otherwise the response has status "approval_required" with an approval_url that a human must open to pay with PayPal. Never promises payment outside the mandate." Scope: every tool checks the target project belongs to `agent.clientId` (else tool error "project not accessible"). Empty `text` → tool error `isError: true`, "text is required" (Review Focus 5). Resource template `quote://{quoteId}` → Markdown of the latest version.
- `routes.ts`: `app.all('/mcp', …)` reads `Authorization: Bearer <token>`; `app.all('/mcp/:token', …)` reads the path token; both → `authenticateAgentToken` (null → 401 JSON `{ error: 'invalid token' }`) → new `McpServer` + `new StreamableHTTPTransport({ sessionIdGenerator: undefined })` (stateless, one server per request) → `server.connect(transport)` → `transport.handleRequest(c)`.

- [ ] **Step 1: Write failing tests** `server.test.ts`: start the app with `serve()` on an ephemeral port; connect `@modelcontextprotocol/sdk/client` `StreamableHTTPClientTransport` with the bearer token; `listTools()` returns 8 names; `request_quote` for P1 with demo text 3 → `structuredContent.totalCents === 6000`; `accept_quote` with an active funded mandate → `status 'paid'`; with text 2 → `approval_required` with `approvalUrl`; `request_quote` with `text: ''` → `isError`; unknown token → HTTP 401; revoked token → 401; capability URL form works the same as the header form.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp): streamable HTTP server with scoped tools and quote resource` and push.

### Task C2: MCP docs and verified client snippets

**Files:**
- Create: `docs/mcp.md`
- Modify: `apps/backend/src/access/snippets.ts` (only if a client's syntax differs from the current docs)

- [ ] **Step 1: Verify** the three snippet forms against the clients' current documentation on the day (Claude Desktop custom connectors: URL only; Claude Code `claude mcp add --transport http … --header`; Cursor `mcp.json` `url` + `headers`); add Codex only if its remote MCP syntax is documented. Record the verification date in `docs/mcp.md`.
- [ ] **Step 2: Write `docs/mcp.md`:** what the server exposes, auth (header and capability URL, both revocable, OAuth as production path), the eight tools with one example each, the `accept_quote` contract, limits.
- [ ] **Step 3: Run the live check locally:** `claude mcp add --transport http dealingwith http://localhost:3000/mcp --header "Authorization: Bearer <token>"` then in Claude Code ask "list the services of my provider" → the tool answers. Note the result in `docs/mcp.md`.
- [ ] **Step 4: Commit** `docs(mcp): connection guide verified against Claude Code` and push.

---

## Phase 1 — Track D: web (`apps/web`)

Design guidance: the implementer loads the `frontend-design` skill before D1 and keeps one visual system (type scale, 8-pt spacing, one accent color, light theme) across every page. Copy in English.

### Task D1: Vite app, routing, session, API client, design tokens

**Files:**
- Create: `apps/web/index.html`, `apps/web/vite.config.ts` (React plugin, `@tailwindcss/vite`, dev proxy `/api`, `/mcp`, `/mock-paypal` → `http://localhost:3000`), `apps/web/src/main.tsx`, `apps/web/src/app.tsx` (routes `/`, `/login`, `/portal/projects/:id`, `/portal/mandates/:id/funded`, `/pay/return`, `/pay/cancel`, `/dashboard`), `apps/web/src/api/client.ts`, `apps/web/src/api/hooks.ts`, `apps/web/src/session.tsx`, `apps/web/src/styles.css`, `apps/web/src/components/{Button,Card,Money,Badge,Layout}.tsx`, `apps/web/src/pages/LoginPage.tsx`
- Test: `apps/web/src/components/Money.test.tsx` (Vitest + `@testing-library/react`, jsdom)

**Interfaces:**
- Produces: `api.get<T>(path)`, `api.post<T>(path, body)` with `credentials: 'include'` and typed responses from `@dealingwith/contracts`; `VITE_API_MODE=fixtures` makes the client resolve from `apps/web/src/dev/fixtures.ts` (project P1 with clauses C1–C3, a published quote for demo request 1 priced at US$80.00, mandate M1 active with headroom, the three services) so the web can be built and reviewed before the API lands; default mode `http`; `useSession()` → `{ session, loginAs(role), logout }`; `<Money cents={8000} />` renders `US$80.00`; `/login` page with the two buttons "Enter as client (Mara)" and "Enter as provider (Andes Data Studio)" → `POST /api/session/login` → redirect to `/portal/projects/<DEMO project id from /api/me>` or `/dashboard`.

- [ ] **Step 1: Write failing test** `Money.test.tsx`: `cents 8000` → text `US$80.00`; `cents 0` → `US$0`.
- [ ] **Step 2: Run** `pnpm --filter @dealingwith/web test` → FAIL. **Step 3: Scaffold and implement** (`pnpm create vite` React + TS template, then the files above). **Step 4: Run** → PASS; `pnpm dev` shows the login page at `http://localhost:5173/login`.
- [ ] **Step 5: Commit** `feat(web): Vite app, routing, demo session and design tokens` and push.

### Task D2: Storefront `/`

**Files:**
- Create: `apps/web/src/pages/StorefrontPage.tsx`, `apps/web/src/components/ServiceCard.tsx`, `apps/web/src/components/PayWithPayPal.tsx`, `apps/web/src/components/RequestBox.tsx`

**Interfaces:**
- Produces: `<PayWithPayPal quoteId version amountCents onPaid />`: when `/api/config.paypalMode === 'sandbox'` renders `PayPalScriptProvider` + `PayPalButtons` (`createOrder` → `POST /api/quotes/:id/accept` returns `payment.paypalOrderId`; `onApprove` → `POST /api/paypal/orders/:orderId/capture`); when `mock`, renders a button "Approve in mock PayPal" that calls accept and opens `approvalUrl` in the same tab. `<RequestBox onSubmit(text) />` with placeholder "Describe what you need". Storefront shows business header, the three services with price and inclusions, "Buy" on S1 (creates a request with text `Buy ${service.name}` → quote → pay), and the request box → quote card (Task D3 component).

- [ ] **Step 1: Implement; verify manually** at `/`: three services visible; "Buy" on S1 leads to the mock approve page and back to `/pay/return` (D5).
- [ ] **Step 2: Commit** `feat(web): storefront with direct purchase` and push.

### Task D3: Project page and quote card (hero)

**Files:**
- Create: `apps/web/src/pages/ProjectPage.tsx`, `apps/web/src/components/ScopeList.tsx`, `apps/web/src/components/QuoteCard.tsx`, `apps/web/src/components/NeedsInfoForm.tsx`, `apps/web/src/hooks/useProjectEvents.ts`
- Test: `apps/web/src/components/QuoteCard.test.tsx`

**Interfaces:**
- Produces: `<QuoteCard quote onAccept onAdjust />`: header "Quote v{version}" + status badge; each line: label, `Included` badge with `US$0` or amount, rationale, expandable "Source: clause C1" / "Rule S2.report.v1"; delivery "{n} day(s)"; total; actions "Ask for an adjustment" (opens `NeedsInfoForm`-style free-text that posts to `/answers`) and "Accept and pay with PayPal" (`PayWithPayPal`). `needs_info` quotes render the questions with inputs and a "Send answers" button. `<ScopeList clauses />` separates contract clauses from paid additionals ("Added from quote v1 on {date}"). `useProjectEvents(projectId)` subscribes to `/api/events?projectId=` with `EventSource` and refetches the project on `quote.paid` and `mandate.updated`.

- [ ] **Step 1: Write failing test** `QuoteCard.test.tsx`: fixture 1 priced quote renders `US$0` next to "Per-branch view", `US$80.00` next to the summary line, the text `S2.report.v1`, and the two action buttons.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; manual check of demo request 1 end to end against the local backend (mock PayPal).
- [ ] **Step 5: Commit** `feat(web): project page with explained quote card and live updates` and push.

### Task D4: Mandate panel and "Connect my agent"

**Files:**
- Create: `apps/web/src/components/MandatePanel.tsx`, `apps/web/src/components/ConnectAgent.tsx`, `apps/web/src/components/CopyField.tsx`

**Interfaces:**
- Produces: `<MandatePanel mandate projectId />`: form (per purchase, total, expiry) → `POST /api/mandates`; "Authorize with PayPal" (amount input, default `US$2,000.00`) → `POST /api/mandates/:id/fund` → open `approvalUrl`; shows limits, "Spent US$x of US$y", "Backed by PayPal authorization" with headroom, status badge, list of agent payments, "Re-authorize" when `headroom < perPurchaseLimit`. `<ConnectAgent />`: "Connect my agent" → label input → `POST /api/agents` → shows the token once plus three `CopyField`s (Claude Desktop, Claude Code, Cursor) from `snippets`, the secret warning, and the list of agents with "Revoke".

- [ ] **Step 1: Implement; manual check:** create mandate → fund via mock approve → panel shows `active` and headroom `US$2,000.00`; issue token → snippets render; revoke → agent disappears.
- [ ] **Step 2: Commit** `feat(web): mandate panel and connect-my-agent` and push.

### Task D5: Return pages

**Files:**
- Create: `apps/web/src/pages/PayReturnPage.tsx`, `apps/web/src/pages/PayCancelPage.tsx`, `apps/web/src/pages/MandateFundedPage.tsx`

**Interfaces:**
- Produces: `/pay/return?token=<orderId>` → `POST /api/paypal/orders/:orderId/capture` → receipt ("Paid US$80.00 · Quote v1 · Capture id …") with a link back to the project; `/pay/cancel` → "Payment cancelled"; `/portal/mandates/:id/funded?token=<orderId>` → `POST /api/mandates/:id/fund/complete { orderId }` → redirect to the project page.

- [ ] **Step 1: Implement; manual check** of both return paths with the mock gateway.
- [ ] **Step 2: Commit** `feat(web): PayPal return pages` and push.

### Task D6: Provider dashboard with AG Studio

**Files:**
- Create: `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/dashboard/studio-config.ts`, `apps/web/src/dashboard/theme.ts`, `apps/web/src/dashboard/fallback/*.tsx` (only if the pivot triggers)

**Interfaces:**
- Produces: `/dashboard` (provider session) loads `/api/dashboard/data` and renders `<AgStudio data={{ sources: [quotes, lines, payments, requests] }} mode="edit" />` from the contracts `DashboardData` (`lines` has one row per quote line with `serviceName`, `ruleId`, `amountCents`, `quoteStatus`) with four preconfigured widgets: revenue by service (bar over `lines` where `quoteStatus === 'paid'`), quotes pipeline by status (stacked over `quotes`), unpaid additionals (grid over `lines` with `kind === 'rule'` and `quoteStatus` in `published`/`accepted`), requests over time (line over `requests`); amounts are cents, formatted as US$ by value formatters; custom theme from `theme.ts` matching the product tokens; license key from `VITE_AG_STUDIO_LICENSE` (empty in trial mode if the library allows); "Reset demo data" button → `POST /api/demo/reset` with a confirm dialog. **Pivot (spec section 5):** if the license key is not in hand by 2026-11-09 20:00 Santiago and AG Studio does not render without it, implement the same four widgets with `ag-grid-community` + `ag-charts-react` in `dashboard/fallback/`, same theme.

- [ ] **Step 1: Implement; manual check:** dashboard renders the four widgets with seeded data; after paying demo request 1, revenue shows `US$80.00`; reset returns to zero.
- [ ] **Step 2: Commit** `feat(web): provider dashboard with AG Studio` and push.

---

## Phase 1 — Track E: docs and Walter's manual tasks

### Task E1: Walter's day-0 actions (manual, no code)

- [ ] Request the AG Studio 45-day trial key at https://www.ag-grid.com/studio/license-pricing/ (needed by 2026-11-09 20:00).
- [ ] PayPal developer dashboard: create a sandbox **business account, country United States, currency USD** (Accounts → Create account → Business); create a sandbox **personal account, United States, balance US$5,000** named for judges; create a REST app "DealingWith Agent" linked to the US business account (or keep the Default Application and relink it); copy client id and secret into the local `.env` only.
- [ ] Create the Render account (sponsor credits) and a YouTube channel or confirm access to one.
- [ ] Open the Devpost project draft and fill title, tagline, "Built With" (PayPal, MCP, Hono, React, AG Grid, Anthropic or OpenAI).

### Task E2: README and AGENTS.md skeletons

**Files:**
- Modify: `README.md`, `AGENTS.md`; Create: `docs/demo-script.md`

- [ ] **Step 1: Write `README.md` sections** with placeholders for the URL and video: Problem and promise; Demo (URL, demo logins, sandbox buyer account for judges); How judges test in two minutes (the five requests); Architecture (diagram); PayPal flows (A, B, funding, webhooks, idempotency); MCP connection (link to `docs/mcp.md`); Evals and tests; Known limits (sandbox only, token auth, authorization lifetime in live, demo sessions). English, no emoji.
- [ ] **Step 2: Write `AGENTS.md`:** repo map, commands (`pnpm dev`, `pnpm test`, `pnpm eval:live`, `pnpm seed`), rules (cents, no LLM prices, versioned quotes, idempotency keys), where tests live, what never gets committed.
- [ ] **Step 3: Write `docs/demo-script.md`:** spec section 9 storyboard with exact clicks and the request texts.
- [ ] **Step 4: Commit** `docs: README, AGENTS and demo script skeletons` and push.

---

## Phase 2 — Integration (sequential, needs credentials)

### Task I1: Sandbox gateway (`integrations/paypal/sandbox.ts`)

**Files:**
- Create: `apps/backend/src/integrations/paypal/sandbox.ts`, `apps/backend/src/integrations/paypal/auth.ts`, `apps/backend/scripts/paypal-smoke.ts`
- Test: `apps/backend/src/integrations/paypal/sandbox.test.ts` (unit, with mocked `fetch`)

**Interfaces:**
- Produces: `SandboxPaypalGateway implements PaypalGateway` over `https://api-m.sandbox.paypal.com` with plain `fetch`: `auth.ts` `getAccessToken()` caches the client-credentials token until 60 s before `expires_in`; `createOrder` → `POST /v2/checkout/orders` with `purchase_units[0].amount = { currency_code: 'USD', value: formatPaypalAmount(...) }`, `custom_id`, `payment_source.paypal.experience_context = { return_url, cancel_url, user_action: 'PAY_NOW' }`, header `PayPal-Request-Id: requestId`; `approveUrl` = link `rel === 'payer-action' || 'approve'`; `captureOrder` → `POST /v2/checkout/orders/{id}/capture`; `authorizeOrder` → `POST /v2/checkout/orders/{id}/authorize`, reads `purchase_units[0].payments.authorizations[0]` (`id`, `expiration_time`); `captureAuthorization` → `POST /v2/payments/authorizations/{id}/capture` with `{ amount, final_capture }`; `verifyWebhookSignature` → `POST /v1/notifications/verify-webhook-signature` with `transmission_id`, `transmission_time`, `cert_url`, `auth_algo`, `transmission_sig`, `webhook_id`, `webhook_event` (parsed raw body) → `verification_status === 'SUCCESS'`. Non-2xx → `PaypalError` with `name`/`details` from the body.
- `scripts/paypal-smoke.ts`: creates a CAPTURE order and an AUTHORIZE order, prints approve links, waits for Enter, authorizes, prints `expiration_time` (spec day-1 check on sandbox expiry), partial-captures US$1.00 with `final_capture: false`, prints the capture id. Also tries Vault setup token creation once and prints the error code (expected `NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE`), capped at 30 minutes total.

- [ ] **Step 1: Write unit tests** with a mocked `fetch`: token cached across two calls; `createOrder` sends `PayPal-Request-Id` and parses the approve link; 422 body → `PaypalError` with `code 'ORDER_NOT_APPROVED'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Run the smoke script** with `PAYPAL_MODE=sandbox` and the US business app; approve in the browser with the judge buyer account; record `expiration_time` and the Vault outcome in `docs/paypal-notes.md`.
- [ ] **Step 6: Commit** `feat(paypal): sandbox gateway and smoke script` and push (no credentials in the diff: `git diff --cached | grep -i -E 'secret|client_id' | grep -v -i 'process.env'` → empty).

### Task I2: Webhooks against the sandbox

- [ ] **Step 1:** run the backend locally with `PAYPAL_MODE=sandbox`, expose it with `cloudflared tunnel --url http://localhost:3000`, register a webhook in the PayPal dashboard for the app pointing at `https://<tunnel>/api/webhooks/paypal` with the six event types of spec 7.4; set `PAYPAL_WEBHOOK_ID`.
- [ ] **Step 2:** pay demo request 1 through the web; confirm in logs `webhook result=processed` for `PAYMENT.CAPTURE.COMPLETED` and `duplicate` when the dashboard "Resend" is used.
- [ ] **Step 3:** note the steps in `docs/paypal-notes.md`; commit and push.

### Task I3: Live model runs

- [ ] **Step 1:** `LLM_PROVIDER=anthropic pnpm eval:live` → 5 of 5 pass; adjust `instructions.md` or skills if not, re-run.
- [ ] **Step 2:** `LLM_PROVIDER=openai pnpm eval:live` → 5 of 5 pass with the same prompts.
- [ ] **Step 3:** commit prompt changes `feat(agent): prompt tuning from live evals` and push.

### Task I4: Render deployment

**Files:**
- Create: `render.yaml` (root), `infra/README.md`, `apps/backend/scripts/start.sh` (`node dist/db/migrate-cli.js && node dist/index.js`)

- [ ] **Step 1: Write `render.yaml`:** one `web` service (`runtime: node`, plan `starter`, `buildCommand: pnpm install --frozen-lockfile && pnpm build`, `startCommand: pnpm --filter @dealingwith/backend start`, `healthCheckPath: /healthz`, env vars from Global Constraints with `sync: false` for secrets, `DATABASE_URL` from the database) and one `pserv`/`databases` entry Postgres plan `starter`, region Oregon.
- [ ] **Step 2: Deploy** via Blueprint from the GitHub repo; set secrets in the Render dashboard; confirm `https://<app>.onrender.com/healthz` → `{ ok: true }` and `/login` renders.
- [ ] **Step 3: Register the production webhook** URL in PayPal; update `PAYPAL_WEBHOOK_ID`; pay demo request 1 on the hosted URL; confirm `processed`.
- [ ] **Step 4: Fund the demo mandate once:** as Mara on the hosted URL, "Authorize with PayPal" US$2,000.00 with the judge buyer account → mandate `active`. Run "Reset demo data" and confirm the funding survives.
- [ ] **Step 5: Verify MCP from the outside:** Claude Code (`claude mcp add --transport http …onrender.com/mcp --header …`) and Claude Desktop (capability URL) both list tools and complete demo request 3 as `paid`; record in `docs/mcp.md`.
- [ ] **Step 6 (optional, Walter's call):** point `dealingwith.si` at Render (custom domain + CNAME), set `APP_URL` accordingly, re-register the webhook URL.
- [ ] **Step 7: Commit** `infra: Render blueprint and start script` and push.

### Task I5: Pre-submission checks

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green on `main`; CI green.
- [ ] Fresh browser, no cookies: `/login` → client → the five requests behave as spec section 6 on the hosted URL; dashboard shows the numbers; reset works.
- [ ] `git ls-files | grep -E 'docs/hackathon|\.env$'` → empty. `gh repo view` shows MIT and public.
- [ ] Render: both services on Starter, no spin-down; MCP `initialize` answers under 3 s from a cold client.

---

## Phase 3 — Submission

### Task S1: README final

- [ ] Fill the hosted URL, demo logins, judge buyer account (email and password of the sandbox personal account), video link, architecture diagram (`docs/architecture.svg` or Mermaid), the two-minute judge path, and the limits. Commit `docs: final README for submission` and push.

### Task S2: Video (under 3 minutes)

- [ ] Record screen per `docs/demo-script.md` from a reset state: web request 1 and payment; "Connect my agent" into Claude Desktop or Claude Code; request 2 → approval link; request 3 → paid and the project page updating live; dashboard; 30 seconds of repo, tests and webhook logs. Voice-over in English, no third-party music. Export 1080p, upload to YouTube as **public**, title "DealingWith Agent — Turn service requests into paid work (PayPal AI Hackathon)".
- [ ] Put the link in README and Devpost.

### Task S3: Devpost submission (Walter, by 2026-11-12 15:00 Santiago)

- [ ] Fill description (English; names PayPal and AI explicitly), "Built With", repo URL, video URL, hosted URL, sponsor prize AG Grid opt-in, team and country (Chile). Submit. Do not edit after 17:00 Santiago.

---

## Self-review notes (2026-11-07)

- Spec coverage: G1 → T4, A7, I4; G2 → A1–A5, A7, D3, D5; G3 → A3, A5, C1, I4; G4 → A6, C2, D4; G5 → D6; G6 → D2; G7 → A4, A5, A8, T1 CI (the five scenarios are `tests/scenarios/01…05`); G8 → T1, E2, S1–S3. Non-goals respected (no auth, no multi-tenant UI, no Vault beyond the 30-minute probe in I1).
- The five scenario tests of spec 7.8 live in `tests/scenarios/` (Task A8, revised 2026-11-07), end to end through the HTTP API with the fixed demo outputs of `demo-agent-outputs.ts`; Track C extends scenario 3 with the real MCP tool once C1 lands.
- Type consistency checked: `AcceptQuoteResult`, `PolicyDecision`, `PaypalGateway`, `Deps`, `ContextPack`, `runAgent`, `issueAgentToken` names are used identically across A5, A7, C1, D3, D4.
- Proportion: plan ≈ 2× the spec; code bodies appear only for the gateway interface and the `accept_quote` description, both fixed by the spec.
