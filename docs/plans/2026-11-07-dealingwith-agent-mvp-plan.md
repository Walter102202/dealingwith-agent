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
- Branches: Phase 0 works on `main`. Phase 1 tracks work on `track/a`, `track/b`, `track/c`, `track/d`, `track/e`, each in its own git worktree created from `main` (`git worktree add ../dealingwith-track-a -b track/a main`), pushed on every commit (`git push -u origin track/a` the first time). Tracks never merge into `main` themselves. When a track reports done, the integrator (the planning session) merges it into `main` with a merge commit, with Walter's go-ahead, in the order A, B, C, D, E; no rebase of pushed branches, no force-push. Known planned conflict: `apps/backend/agent/port.ts` exists in A (placeholder) and B (real); B's version wins.
- Only the integrator edits `packages/contracts` and `apps/backend/src/db` after Phase 0. If your task needs a new field or schema, write it as a decision file plus a note in your report, and build against a local type extension until the integrator lands it.
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
Phase 1 (parallel after T4)                           ├── Track A commerce core: A1 → A2 → A3 → A4 → A5 → A6 → A7
                                                      ├── Track B agent:         B1 → B2 → B3        (needs T4 only)
                                                      ├── Track D web:           D1 → D2 → D3 → D4 → D5 → D6  (needs T2; wires API as A7 lands)
                                                      └── Track E docs/manual:   E1 (Walter), E2 README/AGENTS skeleton
                                           Track C MCP: C1 → C2  (starts after A5 + A6)
Phase 2 (sequential, needs credentials)    I1 sandbox gateway → I2 webhooks → I3 live model → I4 Render deploy → I5 checks
Phase 3                                    S1 README final → S2 video → S3 Devpost
```

Each parallel track works in its own git worktree on a branch named `track/<letter>`; the integrator rebases and pushes to `main` in the order A, B, C, D (web last because it depends on the API). Tracks only create files under their own folders (listed per task) plus their tests, so merges are trivial. Shared files (`packages/contracts`, `apps/backend/src/db`) are owned by Phase 0 and changed only by the integrator.

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
- `seedDemo(db: Db): Promise<void>` idempotent (upsert by fixed ids). `resetDemoData(db: Db): Promise<void>` deletes `agent_runs`, `webhook_events`, `payments`, `quotes`, `requests`, `client_agents`; restores project clauses to C1–C3; sets mandate `spent_cents = 0` and keeps `paypal_authorization_id`, `funding_amount_cents`, `funding_captured_cents`, `status` (so the funding survives a reset, spec section 6).

- [ ] **Step 1: Write failing tests:** `seedDemo` twice leaves exactly 1 business, 3 services, 1 project with 3 clauses, 1 mandate `pending`; `resetDemoData` after inserting an extra clause and `spent_cents = 6000` restores 3 clauses and `spent_cents = 0` while a previously set `paypal_authorization_id` is unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `demo-data.ts`, `seedDemo`, `resetDemoData`; add `pnpm --filter @dealingwith/backend seed` script (`tsx src/db/seed-cli.ts` reading `DATABASE_URL`).
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `feat(db): idempotent demo seed and reset` and push. Phase 1 tracks may start.

---

## Phase 1 — Track A: commerce core (backend)

### Task A1: Pricing engine (`modules/quotes/pricing.ts`)

**Files:**
- Create: `apps/backend/src/modules/quotes/pricing.ts`, `apps/backend/src/modules/quotes/errors.ts`
- Test: `apps/backend/src/modules/quotes/pricing.test.ts`

**Interfaces:**
- Produces: `priceIntents(intents: LineItemIntent[], ctx: { services: Service[]; scope: ScopeClause[] }): PricedQuote` where `PricedQuote = { lineItems: QuoteLineItem[]; subtotalCents: number; totalCents: number }`. Pure. Rules: `included` → `amountCents 0`, `scopeRef` must name a clause with `included: true` (contract clause or paid additional) else `PricingError('unknown_scope_ref')`; `rule` with `fixed` → amount; `per_unit` → `quantity × amountCents`; `multiplier` → `applyPercent(sum of the other lines of the same service, percent)` as its own line; unknown rule id → `PricingError('unknown_rule')`; a known id with a different version → use the catalog's current version and set `ruleRef` to it (Review Focus 1). `PricingError extends Error { code: 'unknown_rule' | 'unknown_scope_ref' }`.

- [ ] **Step 1: Write failing tests** using `DEMO` services and P1 clauses: (a) `included C1` → one line, 0, total 0; (b) `rule S2.report v1` → 8000; (c) `S3.base` + `S3.per_source ×1` → 19000; (d) adds `S3.rush` → extra line 4750, total 23750; (e) `rule S2.report v9` → priced 8000 with `ruleRef.version === 1`; (f) `rule S9.nope` → throws `PricingError` code `unknown_rule`; (g) `included C2` (excluded clause) → throws `unknown_scope_ref`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(quotes): deterministic pricing engine` and push.

### Task A2: Requests and quotes repository (`modules/requests`, `modules/quotes`)

**Files:**
- Create: `apps/backend/src/modules/requests/requests.ts`, `apps/backend/src/modules/quotes/quotes.ts`, `apps/backend/src/modules/catalog/catalog.ts`, `apps/backend/src/modules/projects/projects.ts`
- Test: `apps/backend/src/modules/quotes/quotes.test.ts`, `apps/backend/src/modules/projects/projects.test.ts`

**Interfaces:**
- Produces: `createRequest(db, { clientId, projectId?, channel: 'web' | 'mcp', agentId?, text }): Promise<Request>`; `listServices(db, businessId): Promise<Service[]>`; `getProject(db, projectId): Promise<Project>` (includes `scopeClauses`); `appendPaidClauses(db, projectId, quote: Quote): Promise<ScopeClause[]>` adds one clause per `extra` line (`id` = next `C{n}`, `text` = line label, `included: true`, `source: { kind: 'quote', quoteId, version }`), idempotent per `(quoteId, version)`; `createQuoteVersion(db, { requestId, priced: PricedQuote, agentOutput, status: 'published' | 'needs_info', agentRunId? }): Promise<Quote>` (version = previous max + 1, marks the previous `published` version `superseded`); `getQuote(db, quoteId): Promise<Quote>`; `getLatestPublishedVersion(db, quoteId): Promise<number | null>`; `setQuoteStatus(db, quoteId, version, status, at?)`. `Quote.id` in the contracts is the stable `quote_id`; every API and MCP payload carries `id` plus `version`.

- [ ] **Step 1: Write failing tests:** creating v1 then v2 marks v1 `superseded` and v2 `published`; `appendPaidClauses` on a quote with one `included` and one `extra` line adds exactly one clause `C4` with `source.quoteId`, and calling it again adds none.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(core): requests, quote versions, catalog and project scope` and push.

### Task A3: Policies (`modules/policies`)

**Files:**
- Create: `apps/backend/src/modules/policies/evaluate.ts`, `apps/backend/src/modules/policies/reserve.ts`, `apps/backend/src/modules/policies/messages.ts`
- Test: `apps/backend/src/modules/policies/evaluate.test.ts`, `apps/backend/src/modules/policies/reserve.test.ts`

**Interfaces:**
- Produces: `evaluate(input: { mandate: Mandate; quote: Quote; latestPublishedVersion: number; now: Date }): PolicyDecision`. Order of checks and outcomes (spec 7.5): status not `active` → `deny mandate_inactive`; `expiresAt < now` → `deny mandate_expired`; `quote.projectId !== mandate.projectId` → `deny wrong_project`; currency → `deny currency_mismatch`; `quote.version !== latestPublishedVersion` → `deny stale_version`; `totalCents > perPurchaseLimitCents` → `needs_approval over_per_purchase`; `spentCents + totalCents > totalLimitCents` → `needs_approval over_total`; `fundingCapturedCents + totalCents > fundingAmountCents` → `needs_approval funding_exhausted`; else `allow`. `messages.ts` exports `policyMessage(reason, ctx): string` with the texts the UI and MCP show verbatim, e.g. `over_per_purchase` → "US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal."
- `reserveSpend(db, { mandateId, amountCents, quote, now }): Promise<PolicyDecision>` runs inside `db.transaction`, `SELECT … FOR UPDATE` on the mandate row, re-evaluates, and on `allow` increments `spent_cents` and `funding_captured_cents` in the same transaction. `releaseSpend(db, { mandateId, amountCents })` reverts both (used when the PayPal capture fails).

- [ ] **Step 1: Write failing tests** `evaluate.test.ts`: one case per reason with the DEMO mandate as `active` (6000 → allow; 19000 → `over_per_purchase`; spent 25000 + 6000 → `over_total`; funding 200000 captured 195000 + 6000 → `funding_exhausted`; version 1 when latest is 2 → `stale_version`; pending → `mandate_inactive`). `reserve.test.ts`: two sequential reservations of 6000 against total 10000 → first `allow`, second `needs_approval over_total`, `spent_cents === 6000`; `releaseSpend` returns it to 0.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(policies): mandate evaluation and locked spend reservation` and push.

### Task A4: PayPal gateway interface and mock (`integrations/paypal`)

**Files:**
- Create: `apps/backend/src/integrations/paypal/gateway.ts`, `apps/backend/src/integrations/paypal/mock.ts`, `apps/backend/src/integrations/paypal/mock-routes.ts`, `apps/backend/src/integrations/paypal/index.ts`
- Test: `apps/backend/src/integrations/paypal/mock.test.ts`

**Interfaces:**
- Produces:

  ```ts
  interface PaypalGateway {
    createOrder(i: { intent: 'CAPTURE' | 'AUTHORIZE'; amountCents: number; customId: string; requestId: string; returnUrl: string; cancelUrl: string }): Promise<{ orderId: string; approveUrl: string }>;
    captureOrder(orderId: string, requestId: string): Promise<CaptureResult>;          // CAPTURE orders
    authorizeOrder(orderId: string, requestId: string): Promise<{ authorizationId: string; amountCents: number; expiresAt: string | null; raw: unknown }>;
    captureAuthorization(authorizationId: string, i: { amountCents: number; finalCapture: boolean; requestId: string }): Promise<CaptureResult>;
    getOrder(orderId: string): Promise<{ status: 'CREATED' | 'APPROVED' | 'COMPLETED' | 'VOIDED'; customId: string; raw: unknown }>;
    verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean>;
  }
  type CaptureResult = { captureId: string; status: 'COMPLETED' | 'PENDING' | 'DECLINED'; amountCents: number; raw: unknown };
  class PaypalError extends Error { code: string; status: number; details: unknown }   // e.g. ORDER_NOT_APPROVED, ORDER_ALREADY_CAPTURED
  ```

  `createPaypalGateway(env): PaypalGateway` picks `mock` or `sandbox` (sandbox implemented in Task I1; until then it throws "sandbox gateway not implemented").
- `MockPaypalGateway` keeps orders in memory keyed by id; `approveUrl = ${APP_URL}/mock-paypal/approve/${orderId}`; `captureOrder` on a non-approved order throws `PaypalError('ORDER_NOT_APPROVED')`, on an already captured one throws `ORDER_ALREADY_CAPTURED`; `captureAuthorization` beyond remaining amount throws `AUTHORIZATION_AMOUNT_EXCEEDED`; `verifyWebhookSignature` → `headers['x-mock-signature'] === env.MOCK_WEBHOOK_SECRET`. `emitWebhook(eventType, resource): Promise<void>` POSTs a PayPal-shaped event (`{ id: 'WH-mock-<n>', event_type, resource }`) with that header to `${APP_URL}/api/webhooks/paypal`.
- `mock-routes.ts`: Hono sub-app mounted only when `PAYPAL_MODE=mock`: `GET /mock-paypal/approve/:orderId` renders a minimal page "Mock PayPal — Approve US$80.00 for quote …" with a form; `POST` marks the order `APPROVED`, emits `CHECKOUT.ORDER.APPROVED`, redirects to the order's `returnUrl` with `?token=<orderId>` (PayPal's real redirect shape).

- [ ] **Step 1: Write failing tests:** create → approve (call the mock's `approve(orderId)` directly) → capture → `COMPLETED` with `amountCents`; capture before approve → `PaypalError` `ORDER_NOT_APPROVED`; AUTHORIZE order → authorize → two partial captures 6000 + 6000 against 200000 then one of 190000 → third throws `AUTHORIZATION_AMOUNT_EXCEEDED`; `verifyWebhookSignature` true/false.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(paypal): gateway interface and mock implementation with approve page` and push.

### Task A5: Payments and workflows (`modules/payments`, `workflows`)

**Files:**
- Create: `apps/backend/src/modules/payments/payments.ts`, `apps/backend/src/workflows/accept-quote.ts`, `apps/backend/src/workflows/capture.ts`, `apps/backend/src/workflows/mandate-funding.ts`, `apps/backend/src/workflows/webhooks.ts`, `apps/backend/src/workflows/events.ts`, `apps/backend/src/workflows/deps.ts`
- Test: `apps/backend/src/workflows/accept-quote.test.ts`, `apps/backend/src/workflows/capture.test.ts`, `apps/backend/src/workflows/webhooks.test.ts`, `apps/backend/src/workflows/mandate-funding.test.ts`

**Interfaces:**
- Consumes: A2 repositories, A3 `reserveSpend`/`releaseSpend`, A4 gateway.
- Produces: `deps.ts`: `type Deps = { db: Db; paypal: PaypalGateway; events: EventBus; env: Env; now: () => Date; agent: AgentPort }` and `type AgentPort = { buildContextPack(db: Db, input: { clientId: string; projectId?: string }): Promise<ContextPack>; runAgent(deps: Deps, input: { pack: ContextPack; text: string; skill: 'contract-service' | 'analyze-additional' | 'explain-quote'; requestId: string; answers?: Record<string, string> }): Promise<{ output: AgentOutput; runId: string }> }` (`ContextPack` and `AgentOutput` from contracts). Track A never imports Track B's files; it talks to the agent only through `deps.agent`. `events.ts`: `EventBus` with `publish(e: DomainEvent)` and `subscribe(fn)`; `DomainEvent = { type: 'quote.published' | 'quote.paid' | 'payment.approval_required' | 'mandate.updated'; projectId: string; payload: unknown }`.
- `acceptQuote(deps, { quoteId, version, actor: { kind: 'web'; clientId } | { kind: 'agent'; agentId; mandateId: string | null } }): Promise<AcceptQuoteResult>`:
  - version not latest → `{ status: 'denied', reason: 'stale_version', message }` (Review Focus 2).
  - web actor, or agent without mandate (`reason 'no_mandate'`), or agent whose `reserveSpend` returns `needs_approval`: create `payments` row `mode pay_now`, `status created`, `idempotencyKey = pay:${quoteId}:${version}` (reuse the existing row if present), `createOrder({ intent: 'CAPTURE', customId: quote:${quoteId}:${version}, requestId: idempotencyKey, returnUrl: ${APP_URL}/pay/return, cancelUrl: ${APP_URL}/pay/cancel })` → `{ status: 'approval_required', approvalUrl, payment, reason?, message? }`; publishes `payment.approval_required`.
  - agent with `allow`: `captureAuthorization(mandate.funding.paypalAuthorizationId, { amountCents, finalCapture: false, requestId: mandate:${quoteId}:${version} })` → on `COMPLETED` call `markPaid`; on `PaypalError` call `releaseSpend` and return `{ status: 'denied', reason: 'funding_exhausted', message }`.
  - `deny` → `{ status: 'denied', reason, message }`.
- `capture.ts`: `captureApprovedOrder(deps, { orderId }): Promise<Payment>` — finds the payment by `paypalOrderId`; if already `captured` returns it (Review Focus 3); else `captureOrder(orderId, payment.idempotencyKey)`; on `ORDER_ALREADY_CAPTURED` fetch via `getOrder` and treat as completed; then `markPaid`. `markPaid(deps, { paymentId, captureId, raw }): Promise<Payment>` in one transaction: payment → `captured`, quote → `paid` with `paidAt`, `appendPaidClauses`, publish `quote.paid`; a second call is a no-op returning the same payment.
- `mandate-funding.ts`: `createMandate(deps, { clientId, projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }): Promise<Mandate>` (status `pending`); `startFunding(deps, { mandateId, fundingAmountCents }): Promise<{ approvalUrl: string; orderId: string }>` creates an AUTHORIZE order with `customId mandate:${mandateId}`, `returnUrl ${APP_URL}/portal/mandates/${mandateId}/funded`; `completeFunding(deps, { mandateId, orderId }): Promise<Mandate>` calls `authorizeOrder`, stores `paypalAuthorizationId`, `fundingAmountCents`, `fundingExpiresAt`, status `active`; publishes `mandate.updated`. `fundingHeadroomCents(m) = fundingAmountCents − fundingCapturedCents`.
- `webhooks.ts`: `processWebhook(deps, { headers, rawBody }): Promise<{ accepted: boolean; result: 'processed' | 'duplicate' | 'ignored' | 'invalid_signature' }>`: verify (false → `invalid_signature`, HTTP 400 at the route); insert `webhook_events` (unique violation → `duplicate`); dispatch `PAYMENT.CAPTURE.COMPLETED` → `markPaid` by `custom_id`/order (unknown → `ignored`, Review Focus 4); `CHECKOUT.ORDER.APPROVED` → payment `approved`; `PAYMENT.CAPTURE.DENIED` → payment `denied`, `releaseSpend` if mandate mode; `PAYMENT.CAPTURE.REFUNDED` → `refunded`; `PAYMENT.AUTHORIZATION.VOIDED` → mandate `revoked`; `PAYMENT.AUTHORIZATION.CREATED` → record only.

- [ ] **Step 1: Write failing tests** against `createTestDb()` + `MockPaypalGateway` + seeded DEMO, using quotes created directly through A2 with hand-written `PricedQuote`s (no agent):
  - `accept-quote.test.ts`: web accept of an 8000 quote → `approval_required` with `approvalUrl` containing `/mock-paypal/approve/`; accept v1 when v2 is published → `denied stale_version`; agent accept 6000 with active funded mandate → `paid`, `spent_cents 6000`, project gains clause with `source.quoteId`; agent accept 19000 → `approval_required over_per_purchase` with `approvalUrl`; agent accept with mandate `pending` → `denied mandate_inactive`; agent with `mandateId: null` → `approval_required`, reason `no_mandate`.
  - `capture.test.ts`: approve in mock then `captureApprovedOrder` → payment `captured`, quote `paid`, 1 new clause; calling it again → same payment id, still 1 new clause, 1 `payments` row.
  - `webhooks.test.ts`: bad signature → `invalid_signature`; valid `PAYMENT.CAPTURE.COMPLETED` for a known order → `processed` and quote `paid`; same event id again → `duplicate`; valid event for unknown order → `ignored` and row stored with `result 'ignored'`.
  - `mandate-funding.test.ts`: `startFunding` → `completeFunding` → mandate `active` with `paypalAuthorizationId` set and `fundingHeadroomCents === 200000`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(payments): accept-quote, capture, mandate funding and webhook workflows` and push.

### Task A6: Access: demo sessions and agent tokens (`access`)

**Files:**
- Create: `apps/backend/src/access/session.ts`, `apps/backend/src/access/agent-tokens.ts`, `apps/backend/src/access/snippets.ts`
- Test: `apps/backend/src/access/agent-tokens.test.ts`, `apps/backend/src/access/session.test.ts`

**Interfaces:**
- Produces: `Session = { role: 'client'; clientId: string } | { role: 'provider'; businessId: string }`; `signSession(s, secret): string` (HMAC-SHA256, `base64url(payload).base64url(sig)`), `verifySession(token, secret): Session | null`; cookie name `dw_session`, `HttpOnly`, `SameSite=Lax`, `Secure` when `APP_URL` is https.
- `issueAgentToken(db, { clientId, label, mandateId? }): Promise<{ token: string; agent: ClientAgent }>` — token `dwa_` + 32 random bytes base64url, stored as SHA-256 hex in `token_hash`; `authenticateAgentToken(db, token): Promise<ClientAgent | null>` (null when unknown or `revoked_at` set; updates `last_used_at`); `revokeAgentToken(db, agentId)`; `listAgents(db, clientId)`.
- `snippets.ts`: `connectionSnippets({ appUrl, token }): { claudeDesktop: string; claudeCode: string; cursor: string }` — Claude Desktop: capability URL `${appUrl}/mcp/${token}` with the one-line secret warning; Claude Code: `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`; Cursor: `.cursor/mcp.json` with `{"mcpServers":{"dealingwith":{"url":"${appUrl}/mcp","headers":{"Authorization":"Bearer ${token}"}}}}`. Task C2 verifies these against the clients' docs and edits the strings if needed.

- [ ] **Step 1: Write failing tests:** issue → authenticate returns the agent; tampered token → null; revoked → null; `verifySession(signSession(s))` round-trips and a flipped byte → null.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(access): demo sessions and hashed agent tokens with connection snippets` and push.

### Task A7: HTTP API, SSE, static serving, app entry (`api`, `index.ts`)

**Files:**
- Create: `apps/backend/src/workflows/submit-request.ts`, `apps/backend/src/workflows/fake-agent.ts` (`fakeAgentPort(outputs: Record<string, AgentOutput>): AgentPort`, matches by substring of the request text; a test helper), `apps/backend/agent/port.ts` (placeholder exporting `createAgentPort(env): AgentPort` that returns `fakeAgentPort` with the five demo outputs inlined; Track B's real file replaces it at merge, record this in a decision file), `apps/backend/src/api/app.ts`, `apps/backend/src/api/routes/session.ts`, `apps/backend/src/api/routes/catalog.ts`, `apps/backend/src/api/routes/projects.ts`, `apps/backend/src/api/routes/quotes.ts`, `apps/backend/src/api/routes/payments.ts`, `apps/backend/src/api/routes/mandates.ts`, `apps/backend/src/api/routes/agents.ts`, `apps/backend/src/api/routes/events.ts`, `apps/backend/src/api/routes/dashboard.ts`, `apps/backend/src/api/routes/demo.ts`, `apps/backend/src/api/routes/webhooks.ts`, `apps/backend/src/api/middleware.ts`, `apps/backend/src/env.ts`, `apps/backend/src/observability/logger.ts`
- Modify: `apps/backend/src/index.ts` (serve on `PORT`, run migrations and `seedDemo` when `DEMO_MODE=true`, mount mock routes when `PAYPAL_MODE=mock`)
- Test: `apps/backend/src/api/app.test.ts`

**Interfaces:**
- Consumes: A2–A6 and `deps.agent` (never Track B's files directly). Produces `createApp(deps): Hono`; `index.ts` builds `deps.agent` with `createAgentPort(env)` from `apps/backend/agent/port.ts`. All JSON bodies validated with `@hono/zod-validator` against contracts schemas; errors `{ error: { code, message } }`.
- Routes (prefix `/api`): `POST /session/login { role: 'client' | 'provider' }` sets the cookie (demo mode only) and returns `Session`; `POST /session/logout`; `GET /me`; `GET /config` → `{ paypalMode, paypalClientId?, appUrl }`; `GET /services`; `GET /projects/:id` → project + quotes + payments + mandate; `POST /projects/:id/requests { text }` → runs `submitRequest(deps, { clientId, projectId?, channel, agentId?, text, answers?, quoteId? }): Promise<Quote>` from `workflows/submit-request.ts` (`createRequest` → B1 `buildContextPack` → B2 `runAgent` → `priceIntents` → `createQuoteVersion` with status `needs_info` when `needsInfo.length > 0` else `published`; `PricingError` → request `failed`, HTTP 422 `{ code: 'invalid_agent_output' }`) → `Quote`; `POST /requests { text }` (storefront, no project); `GET /quotes/:id`; `POST /quotes/:id/answers { answers }` → new version; `POST /quotes/:id/accept { version }` → `AcceptQuoteResult` (web actor from session); `POST /paypal/orders/:orderId/capture` → `Payment`; `POST /mandates { projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }`; `POST /mandates/:id/fund { fundingAmountCents }` → `{ approvalUrl }`; `POST /mandates/:id/fund/complete { orderId }` → `Mandate`; `GET /agents`, `POST /agents { label }` → `{ token, agent, snippets }` (token shown once), `DELETE /agents/:id`; `GET /events?projectId=` SSE stream of `DomainEvent`s via Hono `streamSSE`, heartbeat every 25 s; `GET /dashboard/data` → `{ quotes: FlatQuote[]; payments: FlatPayment[]; requests: FlatRequest[]; services }` flattened rows for AG Studio (provider session); `POST /demo/reset` (provider session) → `resetDemoData`; `POST /webhooks/paypal` raw body → `processWebhook`, 200 on `processed | duplicate | ignored`, 400 on `invalid_signature`. Non-`/api` paths: `serveStatic` from `apps/web/dist` with SPA fallback to `index.html`; `GET /healthz` → `{ ok: true }`.
- `env.ts`: `loadEnv(): Env` with Zod, defaults from Global Constraints. `logger.ts`: structured JSON lines `{ level, msg, ...fields }`.

- [ ] **Step 1: Write failing tests** with `app.request()`: login as client sets cookie; `GET /api/projects/:id` without cookie → 401; `POST /api/projects/:id/requests` with `deps.agent = fakeAgentPort(...)` and demo request 1 text → 200, quote `published`, `totalCents 8000`; `POST .../requests { text: '' }` → 400; `POST /api/quotes/:id/accept` → `approval_required`; `POST /api/webhooks/paypal` with bad signature → 400; `GET /healthz` → 200.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `pnpm --filter @dealingwith/backend dev` serves `http://localhost:3000/healthz`.
- [ ] **Step 5: Commit** `feat(api): HTTP API, SSE events, static serving and app entry` and push.

---

## Phase 1 — Track B: agent

### Task B1: Context pack (`agent/context`)

**Files:**
- Create: `apps/backend/agent/context/build.ts`, `apps/backend/agent/context/render.ts`
- Test: `apps/backend/agent/context/build.test.ts`

**Interfaces:**
- Produces: `buildContextPack(db, { clientId, projectId?: string }): Promise<ContextPack>` (`ContextPack` is the contracts type from T2, validated with `ContextPackSchema.parse` before returning); `renderContextPack(pack): string` — Markdown with every id visible (`[C1] included — five views including a per-branch view`, `[S2.report.v1] fixed US$80.00 — scheduled report email`), so the model can cite them.

- [ ] **Step 1: Write failing tests:** pack for P1 has 3 services, 3 clauses, `mandate` present; after `appendPaidClauses` for a paid quote, the pack has 4 clauses and the fourth has `source.kind 'quote'`; `renderContextPack` output contains `[C1]` and `[S2.report.v1]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): context pack with source references` and push.

### Task B2: LLM provider switch and agent run (`agent/`)

**Files:**
- Create: `apps/backend/agent/instructions.md`, `apps/backend/agent/skills/contract-service.md`, `apps/backend/agent/skills/analyze-additional.md`, `apps/backend/agent/skills/explain-quote.md`, `apps/backend/agent/provider.ts`, `apps/backend/agent/run.ts`, `apps/backend/agent/port.ts`, `apps/backend/agent/mock-fixtures.ts`, `evals/scenarios/fixtures/*.json`
- Test: `apps/backend/agent/run.test.ts`, `apps/backend/agent/provider.test.ts`

**Interfaces:**
- Produces: `getModel(env): LanguageModel` — `anthropic` → `createAnthropic({ apiKey })(env.LLM_MODEL ?? 'claude-opus-5-5')`; `openai` → `createOpenAI({ apiKey })(env.LLM_MODEL ?? 'gpt-5')`; `mock` → `MockLanguageModel` (from `ai/test`, or a `MockLanguageModelV3`-style stub per the installed `ai@7` types) that returns the fixture whose `match` regex matches the request text. Verify exact import names against the installed `ai`, `@ai-sdk/anthropic` and `@ai-sdk/openai` type declarations before writing; do not use the `"anthropic/model"` gateway string form (it needs a Vercel gateway key).
- `apps/backend/agent/port.ts`: `createAgentPort(env): AgentPort` returning `{ buildContextPack, runAgent }` (the `AgentPort` type comes from Track A's `workflows/deps.ts`; Track A ships a placeholder `agent/port.ts` with the same export that the integrator replaces with this one at merge). `runAgent(deps, { pack: ContextPack; text: string; skill: 'contract-service' | 'analyze-additional' | 'explain-quote'; requestId; answers?: Record<string, string> }): Promise<{ output: AgentOutput; runId: string }>` — `generateText({ model, system: instructions + skill file, prompt: renderContextPack(pack) + request (+ answers), output: Output.object({ schema: AgentOutputSchema }) })`; one retry on schema failure; inserts `agent_runs` (`provider`, `model`, `prompt_version` = git short SHA or `'dev'`, tokens, latency, `outcome: 'ok' | 'invalid_output' | 'error'`).
- Fixtures `evals/scenarios/fixtures/`: `01-web-monday-summary.json` (included C1 + rule S2.report), `02-agent-amazon-source.json` (S3.base + S3.per_source ×1), `03-agent-sales-drop-alert.json` (S2.alert), `04-already-covered.json` (included C4), `05-needs-info.json` (`needsInfo` with the data-volume question, empty `lineItems`). Each `{ match: string; output: AgentOutput }`.
- `instructions.md` (English): role, "classify every need as included or extra against the scope clauses, contract clauses and paid additionals alike", "ask when information changes the price", "never invent services, rules or prices; amounts are computed by the system", "cite the clause id or rule id for every line", output format note.

- [ ] **Step 1: Write failing tests:** `provider.test.ts`: `getModel({ LLM_PROVIDER: 'mock' })` returns a model; `anthropic` without key throws "ANTHROPIC_API_KEY is required"; `openai` likewise. `run.test.ts` (mock): request 1 text → output with `included C1` and `rule S2.report`; request 5 text → `needsInfo.length === 1`; an `agent_runs` row exists with `outcome 'ok'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(agent): provider switch (anthropic, openai, mock), instructions, skills and structured run` and push.

### Task B3: Live eval and graders (`evals/`)

**Files:**
- Create: `evals/live/run.ts`, `evals/graders/classification.ts`, `evals/README.md`, root script `pnpm eval:live`

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
- Consumes: A5 workflows, A6 `authenticateAgentToken`, A2 repositories, A7 `submitRequest` from `workflows/submit-request.ts`.
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
- Produces: `/dashboard` (provider session) loads `/api/dashboard/data` and renders `<AgStudio data={{ sources: [quotes, payments, requests] }} mode="edit" />` with four preconfigured widgets: revenue by service (bar), quotes pipeline by status (stacked), unpaid additionals (grid), requests over time (line); custom theme from `theme.ts` matching the product tokens; license key from `VITE_AG_STUDIO_LICENSE` (empty in trial mode if the library allows); "Reset demo data" button → `POST /api/demo/reset` with a confirm dialog. **Pivot (spec section 5):** if the license key is not in hand by 2026-11-09 20:00 Santiago and AG Studio does not render without it, implement the same four widgets with `ag-grid-community` + `ag-charts-react` in `dashboard/fallback/`, same theme.

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

- Spec coverage: G1 → T4, A7, I4; G2 → A1–A5, A7, D3, D5; G3 → A3, A5, C1, I4; G4 → A6, C2, D4; G5 → D6; G6 → D2; G7 → A4, A5, T1 CI, scenario tests (A5/A7/C1 cover the five scenarios: included → A1/A7; needs_info → B2/A7; MCP then web same id → C1 + D3 share `getQuote`; payment pending → A5 capture tests; duplicates → A5 webhook/capture tests); G8 → T1, E2, S1–S3. Non-goals respected (no auth, no multi-tenant UI, no Vault beyond the 30-minute probe in I1).
- The five scenario tests of spec 7.8 are implemented as named tests inside A1, A5, A7 and C1 rather than a separate `tests/scenarios/` folder; the integrator adds `tests/scenarios/README.md` pointing at them so a judge finds them. Decision by the planner to avoid duplicating fixtures.
- Type consistency checked: `AcceptQuoteResult`, `PolicyDecision`, `PaypalGateway`, `Deps`, `ContextPack`, `runAgent`, `issueAgentToken` names are used identically across A5, A7, C1, D3, D4.
- Proportion: plan ≈ 2× the spec; code bodies appear only for the gateway interface and the `accept_quote` description, both fixed by the spec.
