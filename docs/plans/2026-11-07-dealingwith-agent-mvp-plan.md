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
5. An MCP request with a revoked or unknown token, and a `request_quote` with empty text. Expected: HTTP 401 for the token; for the empty request the SDK rejects the call before the handler runs (a JSON-RPC `InvalidParams` error whose message contains "text is required"); nothing persisted. Tests in Task C1.

---

## How to work on this plan

Written for a session (Claude Code, Codex or a human) that opens this repository with no other context.

### Before you start a track (preflight)

Run these in order. Every step has an expected result; if yours differs, stop and write what you saw in your report instead of improvising.

1. `cd` into the main checkout and `git pull`. Expected: `git log --oneline -1` shows the commit the track's revision note names, or a later one on `main`.
2. `git worktree add ../dealingwith-track-<letter> -b track/<letter> main`, then `cd ../dealingwith-track-<letter>` and `pnpm install`. Expected: install finishes and `git status --short` prints nothing (the lockfile did not change). If `track/<letter>` already exists (you are resuming), `cd` into the existing worktree and `git pull` instead.
3. `pnpm lint`, `pnpm typecheck`, `pnpm test`. Expected: all three green, with at least the test-file and test counts the track's revision note gives for `main`. Fewer tests means a wrong checkout.
4. `git config user.name` prints `Walter102202` and `git config user.email` prints `walterguzman2202@gmail.com`.
5. Create the folder `dealingwith-reports/` next to the repository if it does not exist (on Walter's machine `C:\dev\dealingwith-reports\`); your report lives at `dealingwith-reports/track-<letter>.md`, outside the repo.
6. Resume rule: read your milestone section in `docs/milestones.md`; the first unticked line is where you continue. This holds at the start and after any restart.

Ports, so parallel sessions never collide: Track A runs the backend on `3000`; Track D runs Vite on `5173` and, when it needs its own backend, starts it with `PORT=3001`; Track C runs its backend on `3002`; Track B listens on nothing and never runs `pnpm dev`.

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

### Bugs you find along the way

Fix them without asking.

- A bug in your track's code, or in existing code your track depends on and may edit, is fixed on your branch: failing test first, then the fix, then the affected suite. One commit per bug (`fix(scope): ...`), separate from the task commit. Report it with `file:line`, symptom, root cause and the test that pins it.
- A class of bug gets one sweep, not just the instance you saw.
- If the fix needs a file you may not touch (`packages/contracts`, `apps/backend/src/db`, root configuration), do not stop: describe the change in the report under "Needs the integrator", work around it when you safely can, and continue.
- A big, unrelated pre-existing bug is not fixed: it goes under "Found, not fixed" with evidence.
- Speed rule: fix only what breaks something (a failing test, a wrong result, a scenario that cannot complete). Cosmetic or theoretical issues go to the report under "Found, not fixed" and wait until after submission.
- Never delete, skip or weaken a test to make it pass. Never touch anything outside your worktree.

### Integration checks (integrator only)

- Every track is reviewed by a session that did not write it (a fresh read-only session or a reviewer subagent). Every finding is verified against the code (`file:line`) before it is applied.
- Before merging a track, the integrator re-runs `pnpm lint && pnpm typecheck && pnpm test && pnpm build` in a clean worktree of that branch, then test-merges all finished track branches into a throwaway branch and runs the same commands on the combined tree.
- When an important problem persists after one fix, find the root cause instead of launching another round. Minor items go to a list for after submission.

### Known traps of this stack

Each one has already cost someone time.

- ESM: every relative import ends in `.js` even when the file is `.ts`. `exactOptionalPropertyTypes` is on: never assign `undefined` to an optional key; omit the key (`compact()` from A0 exists for this).
- Vitest collects only `*.test.ts` (and `*.test.tsx` where a project configures jsdom) under each workspace listed in the root `vitest.config.ts`. A test in a folder that is not a workspace, or named `.spec.ts`, silently never runs. Check the "Test Files" count after every run.
- PGlite is a single connection: `createTestDb()` once per test file, `closeDb(db)` in `afterAll`, no concurrent transactions inside one test. `seedDemo(db)` gives P1, M1 and the catalog with the fixed ids in `demo-data.ts`.
- `agent_runs.request_id` and `quotes.request_id` are foreign keys: tests insert a `requests` row first. `quotes` has the composite key `(quote_id, version)`; `Quote.id` in contracts is `quote_id`.
- `tsc` copies nothing but `.ts` output: Markdown, JSON or HTML read at runtime from `dist/` needs an explicit copy step in the package `build` script, and `apps/backend/tsconfig.build.json` has `rootDir: "src"`, so runtime files live under `src/`.
- Biome formats on `pnpm lint:fix` and ignores `*.md`; line width 100, single quotes. Run `pnpm lint:fix` before `pnpm lint` when the diff is large.
- Long shell heredocs break on Windows shells; write files with your editor tool and keep shell commands short.

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
5. The report below is written to `dealingwith-reports/track-<letter>.md` (outside the repo) and pasted in the chat. Never ask anyone to paste a report for you.

### Reporting format (end of each task or session)

Append one block per task to `dealingwith-reports/track-<letter>.md` and paste the same text in the chat. When the track's last task is done, end the file with the line `STATUS: DONE`.

```text
Task: A5 - payments and workflows
Status: done | blocked (why) | partial (what is missing)
Tests: <command> -> <last lines of output>
Decisions: docs/decisions/2026-11-08-release-spend-on-paypal-error.md
Bugs fixed: <file:line, symptom, root cause, pinning test> or none
Found, not fixed: <evidence> or none
Needs the integrator: <changes outside your files> or none
Notes for the next task: <interfaces added or changed, gotchas, exact import names you used>
Friction: <anything you did by hand that the plan should have covered> or none
```

If your context grows large: finish the current task, commit, push, update the report, and suggest `/compact` before continuing. A new session resumes from the first unticked milestone line with the same brief.

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
Phase 1 (parallel after T4)                           ├── Track A commerce core: A0 → … → A8 → A9 hardening
                                                      ├── Track B agent:         B1 → B2 → B3        (needs T4 only)
                                                      ├── Track D web:           D1 → D2 → D3 → D4 → D5 → D6  (needs T2; fixtures mode until A7 lands)
                                                      └── Track E docs/manual:   E1 (Walter), E2 README/AGENTS skeleton
                                           Track C MCP: C1 → C2  (starts from main after the A merge)
Phase 2 (sequential, needs credentials)    I1 sandbox gateway → I2 webhooks → I3 live model → I4 Render deploy → I5 checks
Phase 3                                    S1 README final → S2 video → S3 Devpost
```

Each parallel track works in its own git worktree on a branch named `track/<letter>`; the integrator merges into `main` with merge commits in the order A, B, C, D, E (web after the API it depends on). Tracks only create files under their own folders (listed per task) plus their tests, so merges are trivial. Shared files (`packages/contracts`, `apps/backend/src/db`) are owned by Phase 0 and changed only by the integrator.

Calendar (America/Santiago), revised 2026-11-07 evening after the independent critique. Track A finished A0–A8 on Fri 11-07; the real services move two days earlier.

- Sat 11-08 morning: Walter's E1 (sandbox US business + US personal judge account, REST app, Render account, AG Studio trial key, Anthropic and OpenAI keys). A9 (Codex), B3, D1–D2. Spikes 1 and 4 as soon as the credentials exist.
- Sat 11-08 evening: A on `main`; C1 starts from `main`; spike 3 (Render skeleton with MCP) and spike 2 (webhook signature through a tunnel); I1 starts on `track/i`.
- Sun 11-09: B3 merged, C1–C2, D3–D6; I1 unit tests, I2 through the tunnel; spike 5 (live model, both providers); AG Studio decision by 12:00 (only if spike 4 failed).
- Mon 11-10: merge C, D, E; I3 on both providers; I4 deploy `main`, register the webhook, fund the demo mandate; MCP from Claude Desktop against the hosted URL.
- Tue 11-11: I5, README final, demo-script dry run from a reset state, video recorded.
- Wed 11-12: video edited and uploaded by 11:00; Devpost submitted by 13:00; two-hour buffer; nothing after 15:00.
- Mon 11-30: Walter re-authorizes the demo mandate's funding (judging 12-01 to 12-15; everything stays alive until 12-21).

Spikes (throwaway scripts outside the tracks, results written to `docs/paypal-notes.md` or the decision log), each with what it must prove:

1. **PayPal sandbox smoke** (needs the REST app): a `CAPTURE` order → approve with the judge account → capture; an `AUTHORIZE` order → authorize → read `expiration_time` → two partial captures with `final_capture: false`; the approve link `rel` and the return-URL query shape (`token`, `PayerID`); replaying `PayPal-Request-Id` returns the same order; leave one approved order to capture on Sunday to measure order expiry.
2. **Webhook verification** (needs spike 1 and a tunnel such as `cloudflared`): one real `PAYMENT.CAPTURE.COMPLETED` verifies `SUCCESS` through `verify-webhook-signature`; "Resend" yields the same event id; headers arrive lowercase (I1 reads `paypal-transmission-id` and friends in lowercase); simulator events cannot be verified, only real ones.
3. **Render skeleton** (needs the Render account): Hono + `@hono/mcp` hello on Starter with a Postgres instance; proves the build command (`corepack enable && pnpm install --frozen-lockfile && pnpm build`, Node 22), `/healthz`, migrations against Render Postgres (internal URL, no SSL; the external URL needs `sslmode=require`), and Claude Desktop plus Claude Code listing tools via `/mcp/<token>`. Current Render Postgres plan names are `basic-256mb` and up, not `starter`.
4. **AG Studio without a key**: done 2026-11-07 at package level (`ag-studio@3.1.0` ships trial and watermark handling, so keyless rendering is expected); D6 confirms on screen at its first render and records the license entry point.
5. **Live model** (needs both keys): requests 1 and 5 through `generateText` + `Output.object(AgentOutputSchema)` on Anthropic and OpenAI; both accept the schema (`strictObject`, a `.default(1)` and an optional record are the risky parts for OpenAI strict mode); latency measured; the default model chosen from the numbers.

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
  | 1 | `mandate.status` in `pending`, `expired`, `revoked` (`active` and `exhausted` pass) | `needs_approval mandate_inactive` (was `deny` until A9) |
  | 2 | `new Date(mandate.expiresAt) < now`, or `funding.fundingExpiresAt` defined and `< now` | `needs_approval mandate_expired` / `needs_approval funding_exhausted` (A9) |
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

- [ ] **Step 1: Write failing tests.** `mandates.test.ts`: `toMandate(seeded M1)` passes `MandateSchema.parse`, `remainingCents === 30000`, `fundingHeadroomCents === 200000`; `findMandateForProject` finds M1 for P1 and `null` for a random project. `evaluate.test.ts`: with M1 as `active` (funding 200000, captured 0) and a published P1 quote: 6000 → `allow`; 19000 → `needs_approval over_per_purchase` with the exact `US$190.00 …` message; spent 25000 + 6000 → `over_total` with `remaining US$50.00`; captured 195000 + 6000 → `funding_exhausted`; version 1 when latest is 2 → `deny stale_version`; latest `null` → `stale_version`; `pending` → `needs_approval mandate_inactive`; `exhausted` with spent 30000 → `over_total` (not `mandate_inactive`); `expiresAt` yesterday → `mandate_expired`; quote of another project → `wrong_project`. `messages.test.ts`: one assertion per reason text above. `reserve.test.ts`: against the seeded M1 set to `active`: two sequential reservations of 6000 with `totalLimitCents 10000` → `allow` then `needs_approval over_total`, row shows `spent_cents 6000`, `funding_captured_cents 6000`; `releaseSpend` 6000 → both back to 0; a reservation that reaches exactly `total_limit_cents` flips `status` to `exhausted`, `releaseSpend` flips it back to `active`; `Promise.all` of two reservations of 6000 against 10000 → exactly one `allow`.
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
  7. Mandate capture: `updateQuoteStatus(... 'accepted', acceptedAt)`; `payment = createPayment({ mode: 'mandate', idempotencyKey: `mandate:${quoteId}:${version}`, paypalAuthorizationId })`; `captureAuthorization(authorizationId, { amountCents, finalCapture: false, requestId: idempotencyKey })`; `COMPLETED` → `markPaid(deps, { paymentId, quoteId, version, captureId, raw })` → `{ status: 'paid', payment }`. On any `PaypalError` from authorization capture → release spend once, retain the denied mandate payment, and use step 8 to return `approval_required` with reason `funding_exhausted`, the policy message and an approval URL. Non-PayPal errors propagate.
  8. Pay now (web actor, or agent without a usable mandate): `payment = createPayment({ mode: 'pay_now', idempotencyKey: `pay:${quoteId}:${version}`, amountCents })`; if it already has `paypalOrderId`, reuse it and its stored `raw.approveUrl`; else `createOrder({ intent: 'CAPTURE', amountCents, customId: `quote:${quoteId}:${version}`, requestId: idempotencyKey, returnUrl: `${APP_URL}/pay/return`, cancelUrl: `${APP_URL}/pay/cancel` })` and store `paypalOrderId` and `raw.approveUrl`; `updateQuoteStatus(... 'accepted', acceptedAt)` when not yet accepted; publish `payment.approval_required` (with `approvalUrl`, `reason?`, `message?`); return `{ status: 'approval_required', approvalUrl, payment, reason?, message? }`.
- `capture.ts`: `captureApprovedOrder(deps, { orderId }): Promise<Payment>`: `findPaymentByOrderId` (404 `payment_not_found`); `status === 'captured'` → return it unchanged (Review Focus 3); `captureOrder(orderId, payment.idempotencyKey)`: `COMPLETED` → `markPaid`; `PENDING` → payment `approved`, return; `DECLINED` → payment `denied`, return; `PaypalError ORDER_ALREADY_CAPTURED` → `getOrder` and `markPaid` with its `captureId`; `ORDER_NOT_APPROVED` → `AppError('order_not_approved', 409)`. `markPaid(deps, { quoteId, version, paymentId?, captureId?, raw? }): Promise<{ quote: Quote; payment?: Payment; appendedClauses: ScopeClause[] }>` in one transaction: if the quote version is already `paid` → return the current state without writing; else payment (when given) → `captured` with `paypalCaptureId` and `raw`; quote → `paid` with `paidAt` (also when the version is `superseded`: a human approved that exact version in PayPal, so the money and the scope are recorded); `appendPaidClauses` when the quote has a project; after commit publish `quote.paid` with `quote`, `payment`, `project`.
- `mandate-funding.ts`: `createMandate(deps, { clientId, projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }): Promise<Mandate>` (`pending`; `AppError('invalid_mandate', 400)` when `perPurchase > total`, `expiresAt <= now`, or the project is not the client's; `AppError('mandate_exists', 409)` when a non-revoked mandate exists for the project); `updateMandateLimits(deps, { mandateId, perPurchaseLimitCents, totalLimitCents, expiresAt }): Promise<Mandate>` (status unchanged; same validations); `startFunding(deps, { mandateId, fundingAmountCents }): Promise<{ approvalUrl: string; orderId: string }>` → `createOrder({ intent: 'AUTHORIZE', amountCents: fundingAmountCents, customId: `mandate:${mandateId}`, requestId: `fund:${mandateId}:${toIso(now)}`, returnUrl: `${APP_URL}/portal/mandates/${mandateId}/funded`, cancelUrl: `${APP_URL}/portal/projects/${projectId}` })`; `completeFunding(deps, { mandateId, orderId }): Promise<Mandate>` → `getOrder` must have `customId === mandate:${mandateId}` (403 `order_mismatch`), `authorizeOrder(orderId, `authorize:${orderId}`)`, then set `paypalAuthorizationId`, `fundingAmountCents = authorized amount`, `fundingCapturedCents = 0`, `fundingExpiresAt`, `status = 'active'` (from `pending` or `active`; `exhausted` stays `exhausted` because the policy budget, not the funding, is spent), publish `mandate.updated`; `revokeMandate(deps, { mandateId }): Promise<Mandate>` → `revoked`, publish `mandate.updated` (voiding the PayPal authorization is in the roadmap).
- `webhooks.ts`: `processWebhook(deps, { headers: Record<string, string>; rawBody: string }): Promise<{ result: 'processed' | 'duplicate' | 'ignored' | 'invalid_signature' }>`: `verifyWebhookSignature` false → `invalid_signature` (the route answers 400, nothing stored); parse JSON (`id`, `event_type`, `resource`); one transaction: `INSERT INTO webhook_events … ON CONFLICT (paypal_event_id) DO NOTHING RETURNING id` → no row → `duplicate`; else dispatch and store `result` and `processed_at` in the same transaction (an exception rolls the row back so PayPal's retry is processed). Dispatch:
  - `PAYMENT.CAPTURE.COMPLETED`: resolve the payment in this order: `findPaymentByCaptureId(resource.id)`; else `findPaymentByOrderId(resource.supplementary_data.related_ids.order_id)` with `mode pay_now`; else `custom_id` matching `quote:{quoteId}:{version}` → `findPaymentForQuoteVersion`; nothing → `ignored` (Review Focus 4). Found → `markPaid` (no-op when already paid) → `processed`.
  - `CHECKOUT.ORDER.APPROVED`: verify and deduplicate, then capture known pay-now orders in `created` or `approved` outside the webhook transaction; record the event afterwards. Capture failures remain retryable; already captured orders are idempotent.
  - `PAYMENT.CAPTURE.DENIED`: payment by capture id or order id → `denied`; `mode mandate` → `releaseSpend`; else `ignored`.
  - `PAYMENT.CAPTURE.REFUNDED`: payment by capture id → `refunded`; else `ignored`.
  - `PAYMENT.AUTHORIZATION.VOIDED`: mandate by `paypalAuthorizationId === resource.id` → `revoked` + `mandate.updated`; else `ignored`.
  - `PAYMENT.AUTHORIZATION.CREATED`: `processed` (record only). Any other type → `ignored`.
- `test/workflow-harness.ts` (test helper): `createHarness(overrides?): Promise<{ deps: Deps; paypal: MockPaypalGateway; events: DomainEvent[]; close(): Promise<void> }>` = `createTestDb()` + `seedDemo` + `MockPaypalGateway` whose `deliverWebhook` calls `processWebhook(deps, …)` in-process + `createEventBus()` recording every event + a fixed `now` + a silent logger + an `agent` that throws (A5 tests never run the agent). Also `publishedQuote(deps, { intents, projectId?, channel? })` creating a request and a published version through A1 and A2 (no agent), and `activateMandate(deps, fundingAmountCents = 200000)` running `startFunding` → mock `approve` → `completeFunding`.

- [ ] **Step 1: Write failing tests** with the harness:
  - `events.test.ts`: `subscribe` receives a published event; the returned function unsubscribes; a throwing listener does not stop the others.
  - `accept-quote.test.ts`: web accept of an 8000 quote → `approval_required`, `approvalUrl` contains `/mock-paypal/approve/`, payment `created` with `idempotencyKey pay:<id>:1`, quote `accepted`, one `payment.approval_required` event; accepting the same version again → same `payment.id` and same `approvalUrl`, still one order in the mock; accept v1 when v2 is published → `denied stale_version` with the message naming version 2 and no payment row; accept a `needs_info` quote → `denied not_acceptable`; web actor of another client → 403; agent accept of 6000 with an activated mandate → `paid`, payment `mode mandate`, mandate `spent_cents 6000`, `funding_captured_cents 6000`, project has a clause C4 with `source.quoteId`, one `quote.paid` event; agent accept of 19000 → `approval_required` with `reason over_per_purchase`, the exact `US$190.00 …` message and an `approvalUrl`, mandate counters unchanged; agent with the seeded `pending` mandate → `approval_required mandate_inactive` with an approval link; agent whose client has no mandate → `approval_required` with `reason no_mandate`; agent accept when the mock authorization has only 2000 left → `approval_required funding_exhausted` with an approval link and `spent_cents` back to 0; accept of a 0-total quote (one `included` line) → `paid` with no payment row and the "Nothing to pay" message.
  - `capture.test.ts`: web accept → `paypal.approve(orderId)` → `captureApprovedOrder` → payment `captured` with `paypalCaptureId`, quote `paid`, project 4 clauses; calling it again → same payment id, still 4 clauses, one `payments` row; capture of an unapproved order → `order_not_approved` 409; a mock whose `captureOrder` throws `ORDER_ALREADY_CAPTURED` → still ends `captured` through `getOrder`.
  - `webhooks.test.ts`: bad signature → `invalid_signature` and no `webhook_events` row; a `PAYMENT.CAPTURE.COMPLETED` built from the mock for a known approved order → `processed`, quote `paid`, row `result 'processed'`; the same event id again → `duplicate`, still one payment and 4 clauses; a valid event for an unknown order → `ignored` and a row with `result 'ignored'` and nothing else changed; `PAYMENT.AUTHORIZATION.VOIDED` for the active mandate → mandate `revoked`; `CHECKOUT.ORDER.APPROVED` → payment `captured`, quote `paid`, one paid event; repeated capture requires no cookie and creates no second capture.
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
  | `GET /api/projects` | C (own projects), or P (all) | `Project[]` (added 2026-11-07 for the web's post-login redirect) |
  | `GET /api/projects/:id` | C owning it, or P | `ProjectView` |
  | `POST /api/projects/:id/requests` | C owning it | `{ text }` → `Quote` (200) |
  | `POST /api/requests` | C | `{ text }` → `Quote` (storefront, no project) |
  | `GET /api/quotes/:id` | C owning it, or P | `Quote` (latest; `?version=` for one) |
  | `GET /api/quotes/:id/versions` | C owning it, or P | `Quote[]` |
  | `POST /api/quotes/:id/answers` | C owning it | `{ answers: Record<string,string> }` → `Quote` |
  | `POST /api/quotes/:id/accept` | C owning it | `{ version }` → `AcceptQuoteResult` (`actor { kind: 'web', clientId }`) |
  | `POST /api/paypal/orders/:orderId/capture` | pay-now order capability; owner check when a session is present | → `Payment` |
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

### Task A9: Payment hardening after the independent critique (2026-11-07)

Two independent reviewers (a "top 1% bar" critic and a "CTO for delivery" critic) read the spec, the plan and the Track A code; the integrator verified every claim below against `track/a` at `4716150`. Each item names the file and the behaviour that was read. Work on `track/a` in the existing worktree after `git merge main` (brings `Payment.mandateId`, `scopeRef` on rule intents and `serviceId` on `RequestQuoteInputSchema`). Same rules as A0–A8: failing test first, one commit per item (`fix(scope): ...` or `feat(scope): ...`), push each, scenarios stay green, report appended to `dealingwith-reports/track-a.md` and the file ends again with `STATUS: DONE`.

**Files:**
- Modify: `apps/backend/src/modules/policies/evaluate.ts`, `apps/backend/src/workflows/accept-quote.ts`, `apps/backend/src/workflows/capture.ts`, `apps/backend/src/workflows/webhooks.ts`, `apps/backend/src/workflows/submit-request.ts`, `apps/backend/src/workflows/fake-agent.ts`, `apps/backend/src/api/routes/payments.ts`, `apps/backend/src/api/routes/requests.ts`, `apps/backend/src/integrations/paypal/{gateway,mock}.ts`, `apps/backend/src/modules/payments/*.ts` (mapper), `apps/backend/src/env.ts`
- Test: the suites beside each file plus `tests/scenarios/` (unchanged expectations except where an item says so)

**Items, in order:**

1. **Approval instead of denial** (`evaluate.ts:15-16`, `accept-quote.ts:198-204`). Today a `pending`, `expired` or `revoked` mandate and a passed expiry return `deny`, and a PayPal-side capture failure other than `AUTHORIZATION_AMOUNT_EXCEEDED` is rethrown (a 502 to the caller), while spec 7.4 Flow B and the policy messages themselves ("Approve this payment in PayPal.") promise an approval link. Change: `mandate_inactive` and `mandate_expired` become `needs_approval`; add a check `funding.fundingExpiresAt` defined and `< now` → `needs_approval` with reason `funding_exhausted`; only `wrong_project`, `currency_mismatch` and `stale_version` stay `deny`. In `accept-quote.ts`, every `PaypalError` from `captureAuthorization` releases the spend and marks the payment `denied` (as now), then falls through to the pay-now branch and returns `approval_required` with reason `funding_exhausted`, the policy message and an `approvalUrl`; only non-`PaypalError` errors propagate. Update the A3 table in this plan and the policy tests; scenario 2 (over per-purchase) is unchanged.

2. **Capture without a browser cookie** (`api/routes/payments.ts:19`, `workflows/webhooks.ts:69-81`, `access/session.ts:12` TTL 86400). A judge who opens the agent's approval link in another browser or after the cookie expires approves at PayPal, lands on `/pay/return`, and the capture route answers 401; `CHECKOUT.ORDER.APPROVED` only marks the payment `approved`, so nothing ever captures. Change: on `CHECKOUT.ORDER.APPROVED` for a `pay_now` payment in `created` or `approved`, call `captureApprovedOrder` (already idempotent through the idempotency key and `markPaid`); and let `POST /api/paypal/orders/:orderId/capture` run without a session when the payment is `pay_now` and not yet captured (the order id is the capability), keeping the ownership check when a session is present. Tests: webhook approved → payment `captured`, quote `paid`, one `quote.paid` event; capture route without cookie → 200 with the captured payment; a second call → the same payment, no second capture.

3. **Expired orders** (`accept-quote.ts:~205` reuses `row.paypalOrderId` and the stored `approveUrl` forever; the mock never expires). PayPal approve links die after about three hours unapproved and an approved order must be captured within about three days. Change: when a payment already has an order, call `deps.paypal.getOrder`; if the status is not `CREATED` or `APPROVED`, or the gateway throws `ORDER_EXPIRED` / `RESOURCE_NOT_FOUND`, create a new order with idempotency key `pay:${quoteId}:${version}:${attempt}` (`attempt` = number of orders so far, stored in `raw.orderAttempts`) and store the new order id and approve url. Add `EXPIRED` to `OrderStatus`, `expireOrder(orderId)` to the mock (test hook) and a test: accept, expire, accept again → a new `MOCK-ORDER-*` id and a working approve url.

4. **Deterministic fixed-price purchase** (`fake-agent.ts:55-59` throws `no_fixture_for_request` 422 for any text outside the five demo keys, so the storefront `Buy Analytics dashboard build` fails in mock mode). Change: `POST /api/requests` and `POST /api/projects/:id/requests` accept the optional `serviceId` now in `RequestQuoteInputSchema`; when present, the service must belong to the client's business (`service.businessId === client.businessId`, else `AppError('forbidden', 'Service belongs to another business', { status: 403 })`; the MCP tool `request_quote` also carries `serviceId`, so this check is the only tenant guard on that path); when the service has exactly one `fixed` rule, `submitRequest` builds the quote without calling the agent: one line `{ kind: 'rule', ref: { id, version }, quantity: 1, label: service.name, rationale: 'Fixed-price service bought from the storefront.' }`, `deliveryDays: service.deliveryDays`, `explanation: 'Fixed price for ${service.name}.'`, no `agent_runs` row, status `published`. A service with zero or several fixed rules falls back to the agent. Test: S1 by `serviceId` → `published`, `totalCents 120000`, one line citing `S1.price v1`.

5. **No 422 for a human request** (`submit-request.ts:75-78` rethrows `PricingError`; `fake-agent.ts:55-59`). With a real model one bad citation becomes "could not be priced" in front of a judge. Change: on `PricingError`, run the agent once more with the text `${text}\n\nThe previous attempt could not be priced: ${error.message}. Cite only clause and rule ids that appear in the context.` (same `requestId`, a second `agent_runs` row); if it fails again, publish a `needs_info` version with one question `We could not match part of your request to the contracted scope (${error.message}). Could you describe what you need in other words?` and `whyItChangesPrice: 'The price depends on which service or clause applies.'`, set the request to `needs_info`, emit `quote.needs_info`. `PricingError` never leaves `submitRequest`. The fake agent stops throwing for unmatched text and returns a `needs_info` output with the question `This demo understands five scripted requests; which one do you mean?` and the same `whyItChangesPrice`. Tests: a fixture that cites `C9` is retried and ends `needs_info`; unmatched text in mock mode → `needs_info`, never 422.

6. **Mandate on the payment** (`modules/payments` mapper; `accept-quote.ts:112` stores `raw.mandateId`). Map `mandateId` from `raw.mandateId` into the contracts `Payment` for `mode: 'mandate'` payments; test on the scenario 3 payment.

7. **Reconcilable mandate captures** (`webhooks.ts:24-46` resolves by capture id, by order id for `pay_now`, or by `custom_id` `quote:…`; a mandate capture is found only after `markPaid` stored the capture id, so a crash between capture and `markPaid` leaves money captured and a quote unpaid). Change: `captureAuthorization` input gains `invoiceId: string`; `accept-quote.ts` passes `mandate:${quoteId}:${version}`; the mock writes it as `invoice_id` on the capture resource; `resolvePayment` also matches `invoice_id` against `/^mandate:([0-9a-f-]{36}):(\d+)$/` via `findPaymentForQuoteVersion`. Test: a `PAYMENT.CAPTURE.COMPLETED` webhook carrying only `invoice_id` resolves and marks the quote paid. (I1 maps `invoiceId` to PayPal's `invoice_id`.)

8. **Deploy before the webhook exists** (`env.ts:30-38` requires `PAYPAL_WEBHOOK_ID` in sandbox, but the webhook can only be registered once the Render URL exists). Change: `PAYPAL_WEBHOOK_ID` optional in sandbox; when absent, `verifyWebhookSignature` returns `false` (every webhook is rejected with 400 `invalid_signature`) and the logger warns once at boot `paypal.webhook_id_missing`. Test on `loadEnv` and on the webhook route.

- [ ] For each item: failing test → run → implement → run → commit → push. After item 8: `pnpm lint && pnpm typecheck && pnpm test` green from the worktree root, CI green, A3/A5/A7 rows of this plan updated where behaviour changed, `docs/milestones.md` A9 ticked, report appended and ending with `STATUS: DONE`.

---

## Phase 1 — Track B: agent

Revised 2026-11-07 by the integrator: the agent lives in `apps/backend/src/agent/` because `apps/backend/tsconfig.build.json` has `rootDir: "src"` (anything outside `src` fails the production build and is skipped by `pnpm typecheck`). Prompts are Markdown files loaded at runtime relative to `import.meta.url`; since `tsc` copies no `.md`, Task B2 adds `apps/backend/scripts/copy-prompts.mjs` to the backend `build` script so `dist/agent/` carries them. `evals/` is a workspace package (`@dealingwith/evals`) like `tests/`: Task B3 adds `- evals` to `pnpm-workspace.yaml` and `'evals'` to the root Vitest projects (a planned one-line overlap with A8 that the integrator resolves). Decision: `docs/decisions/2026-11-07-agent-under-src.md`.

**Preflight numbers.** `main` at `c2b0943` or later; `pnpm test` there reports 11 test files and 42 tests. Branch `track/b`, worktree `../dealingwith-track-b`, report `dealingwith-reports/track-b.md`. Track A (Codex) runs in parallel on `track/a`; never read or depend on that branch.

**Read first for this track**, after the general list above: spec sections 4 (anti-goals), 6 (demo scenario), 7.3 (agent), 7.8 (evals); the Track A introduction (backend conventions), Task A5's Interfaces block (the `AgentPort` type you implement) and Task A7's table of demo agent outputs (your fixtures mirror it); then B1–B3 in full; `docs/decisions/*.md`; and the code you build on: `packages/contracts/src/{agent,context,catalog,scope,quote,mandate}.ts` and `apps/backend/src/db/{schema,demo-data,seed,test-db,client}.ts`. Read them; never guess a name or a column.

**Files you may touch, and nothing else:** `apps/backend/src/agent/**`; `apps/backend/scripts/copy-prompts.mjs`; in `apps/backend/package.json` only the three dependencies and the `build` script (B2); `evals/**` plus the three one-line root additions named in B3; `docs/milestones.md` (M2 lines) and `docs/decisions/` (new files plus their line in `docs/decisions/README.md`). Never: `packages/contracts`, `apps/backend/src/db`, anything else in `apps/backend/src`, `apps/web`, `tsconfig*`, `biome.json`.

**Decisions already taken (do not reopen; build on them):**

- One structured call per request: `generateText({ ..., output: Output.object({ schema: AgentOutputSchema }) })`, no tool loop. One retry when the output fails the schema or the call throws `NoObjectGeneratedError`/`NoOutputGeneratedError`; then the run is recorded with outcome `invalid_output` and `runAgent` throws `AppError`-style `{ code: 'agent_output_invalid' }` (Track A maps it to 422).
- Providers: `createAnthropic({ apiKey })` and `createOpenAI({ apiKey })`; the provider is callable, `provider(modelId)` returns the model. Never the `"anthropic/model"` gateway string. Defaults `claude-opus-5-5` and `gpt-5`; `LLM_MODEL` overrides. `LLM_PROVIDER=mock` needs no key and is what CI and the scenario tests run.
- The model never prices. `AgentOutputSchema` is strict: an amount field in the output is a validation error, never a value. The prompts say so in plain words.
- Prompts are Markdown read at runtime relative to `import.meta.url` through `prompts.ts`; `pnpm --filter @dealingwith/backend build` must leave `dist/agent/instructions.md` and `dist/agent/skills/*.md` in place.
- The five fixtures in `evals/scenarios/fixtures/*.json` equal, field by field, the five rows of the Task A7 table. Fixture ids cite only clauses and rules that exist in `demo-data.ts` (`C1`; `C4` is the clause request 1 creates when paid; `S2.report`, `S2.alert`, `S3.base`, `S3.per_source`).
- `AgentPort`: Track A's `workflows/deps.ts` is not on `main` yet. Define the type locally in `src/agent/port.ts` as a structural type identical to Task A5's Interfaces block (`buildContextPack(db, { clientId, projectId? })` and `runAgent(deps, { pack, text, skill, requestId, answers? })`), with `Deps` typed as `{ db: Db; env: AgentEnv; now?: () => Date }` where `AgentEnv` is `Pick<..., 'LLM_PROVIDER' | 'LLM_MODEL' | 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'>` declared locally with exactly those names (they match `.env.example` and A0's `EnvSchema`). `createAgentPort(env)` is the export Track A's placeholder also has; the integrator switches the import at merge.
- `buildContextPack` reads the database directly with Drizzle (catalog, project with its clauses including paid additionals, prior quote versions, the project's mandate, open questions from `needs_info` versions) and validates with `ContextPackSchema.parse` before returning. `mandate.remainingCents = totalLimitCents - spentCents`.
- Every run writes one `agent_runs` row with the schema's column names: `requestId`, `quoteId`/`quoteVersion` when known, `provider`, `model`, `promptVersion` (git short SHA if available, else `'dev'`), `inputTokens`, `outputTokens`, `latencyMs`, `outcome` (`'ok' | 'invalid_output' | 'error'`), `error` text on failure.

**Verified against the installed types (ai 7.0.165, @ai-sdk/anthropic 4.0.99, @ai-sdk/openai 4.0.111; tarballs inspected 2026-11-07):**

- `import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai'`; `Output.object({ schema })` accepts a Zod 4 schema directly; the parsed object is `result.output` (a getter that throws `NoOutputGeneratedError` when the model produced no object); `result.usage.inputTokens` and `result.usage.outputTokens` are `number | undefined` (store `null` when undefined); `generateText` accepts `system` and `prompt`.
- `import { MockLanguageModelV4 } from 'ai/test'` (`MockLanguageModelV3` also exists; use V4, the current `LanguageModel` union includes both). Constructor takes `{ doGenerate }` where `doGenerate` is a function or a ready `LanguageModelV4GenerateResult`: `{ content: [{ type: 'text', text: JSON.stringify(fixture.output) }], finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, ... }, warnings: [] }` (fill the other `usage` fields from the type; the mock model must return the fixture whose `match` regex matches the request text, so `doGenerate` is a function reading the last user message).
- `import { createAnthropic } from '@ai-sdk/anthropic'` → `createAnthropic({ apiKey })('claude-opus-5-5')`; `import { createOpenAI } from '@ai-sdk/openai'` → `createOpenAI({ apiKey })('gpt-5')`. Both packages peer-depend on `zod ^4.1.8` (satisfied by 4.6.7) and pin `@ai-sdk/provider 4.0.37`; install all three in one `pnpm add --filter @dealingwith/backend` so the lockfile resolves one provider version.
- `ai` also pulls `@ai-sdk/gateway`; it is unused and harmless. Do not set `AI_GATEWAY_API_KEY`.

**Track B traps:** reading `.md` next to source works under `tsx` (dev and tests) and in `dist/` only if `copy-prompts.mjs` ran, so run the backend build once and list `dist/agent`. `agent_runs.request_id` is a foreign key: insert a `requests` row before a run in tests. The prompt version from git (`git rev-parse --short HEAD`) must never throw when git is missing: fall back to `'dev'`.

**Definition of done for the track, all true before you report it done:** B1, B2, B3 committed and pushed on `track/b`; `pnpm lint && pnpm typecheck && pnpm test` green from the worktree root, including the `evals` project; `pnpm eval:live` with `LLM_PROVIDER=mock` prints five passes; `pnpm --filter @dealingwith/backend build` succeeds and `dist/agent/` holds the Markdown prompts; GitHub Actions green on the last push; M2 lines ticked; report ends with `STATUS: DONE`. If Walter puts an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in `.env`, also run `pnpm eval:live` once per provider and paste the table in the report; without keys, say so and stop there (Phase 2 covers live runs).

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
- Produces: `getModel(env: AgentEnv): LanguageModel` — `anthropic` → `createAnthropic({ apiKey })(env.LLM_MODEL ?? 'claude-opus-5-5')`; `openai` → `createOpenAI({ apiKey })(env.LLM_MODEL ?? 'gpt-5')`; `mock` → `new MockLanguageModelV4({ doGenerate })` from `ai/test` that returns the fixture whose `match` regex matches the request text (see the verified names in the track introduction). Missing key → `AppError`-style error with message `ANTHROPIC_API_KEY is required` / `OPENAI_API_KEY is required`. Do not use the `"anthropic/model"` gateway string form (it needs a Vercel gateway key).
- `apps/backend/src/agent/port.ts`: `createAgentPort(env): AgentPort` returning `{ buildContextPack, runAgent }` (the `AgentPort` type comes from Track A's `workflows/deps.ts`; Track A ships a placeholder `agent/port.ts` with the same export that the integrator replaces with this one at merge). `runAgent(deps, { pack: ContextPack; text: string; skill: 'contract-service' | 'analyze-additional' | 'explain-quote'; requestId; answers?: Record<string, string> }): Promise<{ output: AgentOutput; runId: string }>` — `generateText({ model, system: instructions + skill file, prompt: renderContextPack(pack) + request (+ answers), output: Output.object({ schema: AgentOutputSchema }) })`, read `result.output`, re-validate with `AgentOutputSchema.safeParse`; one retry on failure; inserts `agent_runs` (`provider`, `model`, `promptVersion` = git short SHA or `'dev'`, `inputTokens`/`outputTokens` from `result.usage`, `latencyMs`, `outcome: 'ok' | 'invalid_output' | 'error'`, `error`).
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

## Phase 1 — Track C: MCP server (starts from `main` after the Track A merge)

Revised 2026-11-08 by the integrator against `main` at `237c900` (Track A merged) and the published packages `@modelcontextprotocol/sdk@1.32.2` and `@hono/mcp@0.3.5` (tarballs inspected). The MCP endpoint is part of the one backend process: it reuses Track A's workflows, repositories and agent-token access layer, and adds nothing to the database. Decision: `docs/decisions/2026-11-08-mcp-stateless-per-request.md`.

**Preflight numbers.** `main` at `237c900` or later; `pnpm test` there reports 45 test files and 158 tests. Branch `track/c`, worktree `../dealingwith-track-c`, report `dealingwith-reports/track-c.md`, backend port `3002` when you run it. Tracks B and D run in parallel on their branches; never read or depend on them.

**Read first for this track**, after the general list above: spec sections 7.5 (access), 7.6 (MCP tools), 7.8 (scenario 3); the Track A introduction; then C1–C2 in full; `docs/decisions/*.md`; and the code you build on, in this order: `packages/contracts/src/mcp.ts` (the eight tool schemas, `MCP_TOOLS`, `MCP_TOOL_NAMES`), `packages/contracts/src/access.ts` (`ClientAgent`, scopes), `apps/backend/src/access/agent-tokens.ts`, `apps/backend/src/workflows/{deps,submit-request,accept-quote,fake-agent}.ts`, `apps/backend/src/modules/{catalog/catalog,projects/projects,quotes/quotes,payments/payments,mandates/mandates,requests/requests}.ts`, `apps/backend/src/api/{app,auth,errors}.ts`, `apps/backend/src/api/app.test.ts` and `tests/scenarios/03-mcp-then-web.test.ts` (how tests build an app and issue a token), `apps/backend/src/test/workflow-harness.ts` (`createHarness`, `activateMandate`). Read them; never guess a name.

**Files you may touch, and nothing else:** `apps/backend/src/mcp/**` (new); `apps/backend/src/modules/clients/clients.ts` (new, one function); in `apps/backend/src/api/app.ts` only the one line that mounts `mcpRoutes()`; in `apps/backend/package.json` only the two new dependencies and the `mcp:smoke` script; `apps/backend/scripts/mcp-smoke.mjs` (new); `apps/backend/src/access/snippets.ts` only if C2 finds a client's syntax changed; `docs/mcp.md`; `docs/milestones.md` (M3 lines) and `docs/decisions/` (new files plus their line in `docs/decisions/README.md`). Never: `packages/contracts`, `apps/backend/src/db`, `apps/backend/src/workflows`, `apps/backend/src/api/routes/*`, `apps/web`, root configuration files.

**Decisions already taken (do not reopen; build on them):**

- Transport: `@hono/mcp`'s `StreamableHTTPTransport` inside the existing Hono app, stateless: every HTTP request builds a fresh `McpServer` for the authenticated agent and a fresh `new StreamableHTTPTransport({ sessionIdGenerator: undefined })`, connects, handles, done. No session store, no SSE resumption. Claude Desktop, Claude Code and Cursor all work against stateless Streamable HTTP servers.
- Auth is ours, not the SDK's OAuth: `Authorization: Bearer dwa_…` on `/mcp`, or the capability URL `/mcp/:token`. Both go through `authenticateAgentToken(db, token)` (`access/agent-tokens.ts:50`), which returns `null` for malformed, unknown or revoked tokens → respond `401` with body `{ "error": { "code": "unauthenticated", "message": "invalid token" } }` before any MCP parsing. Do not use `@hono/mcp`'s `bearerAuth`/`mcpAuthRouter`.
- Identity: the `ClientAgent` row is the actor. `clientId` scopes every tool; `agent.id` is recorded as `agentId` on requests; `agent.mandateId` is the mandate `accept_quote` pays from (`accept-quote.ts:81-84` already does this; `get_mandate` returns `getMandate(db, agent.mandateId)` or `null` when the agent has no mandate).
- Business lookup: `ClientAgent` has no `businessId`. C1 adds `apps/backend/src/modules/clients/clients.ts` with `getClient(db, clientId): Promise<{ id: string; businessId: string; name: string; email: string }>` (select from `clients`, `notFound('client', id)` when missing, same style as `modules/projects/projects.ts:9-13`). `list_services` is `listServices(db, (await getClient(db, agent.clientId)).businessId)`.
- Scope checks live in `src/mcp/scope.ts`, never inline in tools: `assertAgentOwnsProject(db, projectId, agent)` (`getProject` then `project.clientId === agent.clientId`, else `AppError('forbidden', 'project not accessible', { status: 403 })`), `assertAgentOwnsQuote(db, quoteId, agent)` (`getQuote` → `getRequest(quote.requestId)` → `request.clientId === agent.clientId`, else `AppError('forbidden', 'quote not accessible', { status: 403 })`), `assertAgentOwnsPayment` (payment → its quote → the same rule, message `payment not accessible`). `submitRequest` and `acceptQuote` already enforce ownership (`submit-request.ts:28-37`, `accept-quote.ts:45-50`); call them without duplicating the check.
- Tool handlers never catch `AppError`: the SDK converts any thrown error into a tool result with `isError: true` and `content[0].text = error.message` (`server/mcp.js`, `createToolError`). That is the contract the tests assert ("project not accessible", "You cannot accept this quote").
- Input validation is the SDK's: `inputSchema` is the contracts `z.strictObject` passed as is; an input that fails it is rejected before the handler as a JSON-RPC `InvalidParams` error whose message contains the Zod message (for `request_quote` with `text: ''` the message contains `text is required`) and the handler never runs, so nothing is persisted. Review Focus 5 is tested this way: `await expect(client.callTool({ name: 'request_quote', arguments: { projectId, text: '' } })).rejects.toThrow(/text is required/)`.
- Every tool returns both views: `{ content: [{ type: 'text', text }], structuredContent }` where `structuredContent` is the contracts output object (`{ quote }`, `{ services }`, `{ mandate }`, the `AcceptQuoteResult` itself for `accept_quote`) and `text` is the Markdown from `src/mcp/format.ts`. Money strings use `formatUsd` from `@dealingwith/contracts` (`formatUsd(8000) === 'US$80.00'`).
- `accept_quote` description, verbatim: "Accept a quote version. If the client has an active mandate and the amount is within its limits, the payment is captured immediately with PayPal and the response has status "paid". Otherwise the response has status "approval_required" with an approval_url that a human must open to pay with PayPal. Never promises payment outside the mandate."
- Resource `quote://{quoteId}`: `registerResource('quote', new ResourceTemplate('quote://{quoteId}', { list: undefined }), { title: 'Quote', description: 'The latest version of a quote as Markdown', mimeType: 'text/markdown' }, async (uri, variables) => …)` → `assertAgentOwnsQuote` then `{ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatQuoteMarkdown(quote) }] }`. `variables.quoteId` is `string | string[]`; take the string.

**Verified against the installed types (`@modelcontextprotocol/sdk@1.32.2`, `@hono/mcp@0.3.5`; tarballs inspected 2026-11-08):**

- `import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'`; `new McpServer({ name: 'dealingwith-agent', version })`; `server.registerTool(name, { title?, description?, inputSchema?, outputSchema?, annotations? }, handler)`. `inputSchema`/`outputSchema` accept a Zod 4 object schema directly (`AnySchema = z3.ZodTypeAny | z4.$ZodType`), so `MCP_TOOLS[name].input` and `.output` go in unchanged. `server.tool(...)` and `server.resource(...)` are deprecated; do not use them. `registerResource(name, uriOrTemplate, config, readCallback)` with `ReadResourceTemplateCallback = (uri: URL, variables: Record<string, string | string[]>, extra) => ReadResourceResult`.
- `import { StreamableHTTPTransport } from '@hono/mcp'`; constructor takes the SDK's `StreamableHTTPServerTransportOptions` (`sessionIdGenerator`, `enableJsonResponse`, …) plus `strictAcceptHeader?: boolean` (default `false`, which is what curl and most clients need; leave it); `transport.handleRequest(c: Context): Promise<Response | undefined>` is called from a Hono handler with `return (await transport.handleRequest(c)) ?? c.body(null, 204)`. Flow per request: `const server = createMcpServer(deps, agent); const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined }); await server.connect(transport); return transport.handleRequest(c)`.
- Client side for tests: `import { Client } from '@modelcontextprotocol/sdk/client/index.js'`; `import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'`; `new StreamableHTTPClientTransport(new URL('http://mcp.test/mcp'), { fetch: (input, init) => app.request(input, init), requestInit: { headers: { Authorization: `Bearer ${token}` } } })`. The `fetch` option (`FetchLike`) means no port is opened: Hono's `app.request` is the fetch. `client.listTools()` → `{ tools: [{ name, … }] }`; `client.callTool({ name, arguments })` → `{ content, structuredContent?, isError? }`; `client.readResource({ uri })` → `{ contents }`. Unknown token: `client.connect(transport)` rejects (HTTP 401 surfaces as an error whose message contains `401`); assert with `rejects.toThrow(/401/)`.
- Peers: the SDK needs `zod ^3.25 || ^4.0` (we have 4.6.7) and lists `@cfworker/json-schema` as an optional peer (ignore; the default validator is Ajv, bundled). `@hono/mcp` peer-depends on `hono`, `zod`, the SDK and `hono-rate-limiter ^0.5.4`; pnpm 10 auto-installs peers, so `hono-rate-limiter` appears in the lockfile without being in `package.json`. That is expected; do not add it. Install both in one command: `pnpm add --filter @dealingwith/backend @modelcontextprotocol/sdk@1.32.2 @hono/mcp@0.3.5`.
- The SDK pulls `express`, `cors`, `ajv` and friends; unused here and harmless.

**Track C traps:** the request logger in `api/app.ts` already redacts `/mcp/<token>` in paths; keep the route shape `/mcp/:token` so it stays redacted. `authenticateAgentToken` updates `lastUsedAt` on every call; that is intended. The agent's scopes gate `accept_quote` inside `acceptQuote` (`quote:accept`); issued tokens carry both scopes, so do not re-check scopes in tools. `POST /api/demo/reset` keeps connected agents and their tokens (`db/seed.ts`, `resetDemoData`); quotes, requests and payments are wiped, so a quote id from before a reset is `not found`. Vitest runs the backend project with `customConditions: ["development"]`, so the SDK's ESM entry points resolve normally; if `tsc` complains about the SDK import paths, you are importing from the package root instead of the subpaths above.

**Definition of done for the track, all true before you report it done:** C1 and C2 committed and pushed on `track/c`; `pnpm lint && pnpm typecheck && pnpm test` green from the worktree root with at least 47 test files; `pnpm --filter @dealingwith/backend build` succeeds; GitHub Actions green on the last push; M3 lines ticked; `docs/mcp.md` written with the verification date; the C2 live check against Claude Code done (or, if `claude` is not installed on the machine, done with the SDK client script named in C2 and said so); report ends with `STATUS: DONE`.

### Task C1: MCP server and routes (`src/mcp`)

**Files:**
- Create: `apps/backend/src/mcp/server.ts`, `apps/backend/src/mcp/tools.ts`, `apps/backend/src/mcp/scope.ts`, `apps/backend/src/mcp/format.ts`, `apps/backend/src/mcp/routes.ts`, `apps/backend/src/modules/clients/clients.ts`
- Modify: `apps/backend/src/api/app.ts` (add `mcpRoutes()` to the `for (const routes of [...])` list, after `webhookRoutes()`), `apps/backend/package.json` (two dependencies)
- Test: `apps/backend/src/mcp/server.test.ts`, `apps/backend/src/mcp/format.test.ts`

**Interfaces:**
- Consumes: `submitRequest(deps, { clientId: agent.clientId, projectId?, channel: 'mcp', agentId: agent.id, text, serviceId? })` and `submitRequest(deps, { quoteId, answers, clientId: agent.clientId, channel: 'mcp', agentId: agent.id })` (`workflows/submit-request.ts:26`, both return `Promise<Quote>`; the first form gains `serviceId` with Task A9, pass it through only if the type already has it on your `main`); `acceptQuote(deps, { quoteId, version, actor: { kind: 'agent', agent } })` (`workflows/accept-quote.ts:36`, returns `Promise<AcceptQuoteResult>`); `authenticateAgentToken(db, token)`; `listServices(db, businessId)`, `getProject`, `getQuote(db, quoteId, version?)` (latest when omitted), `getPayment`, `getMandate`, `getRequest`; `Deps` from `workflows/deps.ts`; `ApiEnv` from `api/auth.ts`; `AppError` from `lib/errors.ts`; in tests `createHarness`, `activateMandate` (`test/workflow-harness.ts`), `fakeAgentPort()` (`workflows/fake-agent.ts`), `issueAgentToken(db, { clientId, label, mandateId? })` and `revokeAgentToken` (`access/agent-tokens.ts`), `DEMO` (`db/demo-data.ts`), `createApp`.
- Produces: `createMcpServer(deps: Deps, agent: ClientAgent): McpServer` (`server.ts`; name `dealingwith-agent`, version read from `package.json` through `createRequire(import.meta.url)`); `registerTools(server, deps, agent)` (`tools.ts`; registers the eight tools from `MCP_TOOLS` in `MCP_TOOL_NAMES` order); `formatQuoteMarkdown(quote): string`, `formatServicesMarkdown(services): string`, `formatProjectMarkdown(project): string`, `formatAcceptResultMarkdown(result): string`, `formatPaymentMarkdown(payment): string`, `formatMandateMarkdown(mandate | null): string` (`format.ts`); `mcpRoutes(): Hono<ApiEnv>` (`routes.ts`) mounting `app.all('/mcp', …)` and `app.all('/mcp/:token', …)`.

Tool semantics, one line each (the handler receives the parsed input and returns `{ content, structuredContent }`):
- `list_services` → `{ services }` of the agent's business.
- `get_project` → `assertAgentOwnsProject`, then `{ project }`.
- `request_quote` → `submitRequest` (first form) → `{ quote }`.
- `answer_questions` → `submitRequest` (second form) → `{ quote }`.
- `get_quote` → `assertAgentOwnsQuote`, `getQuote(db, quoteId)` → `{ quote }` (latest version).
- `accept_quote` → `acceptQuote` → the `AcceptQuoteResult` as `structuredContent`; `text` says `Paid US$60.00 (payment <id>).` or `Approval required: <message> Open <approvalUrl> to pay with PayPal.` or `Denied: <message>`.
- `get_payment` → `assertAgentOwnsPayment` → `{ payment }`.
- `get_mandate` → `{ mandate }` from `agent.mandateId`, or `{ mandate: null }`.

Markdown shape of `formatQuoteMarkdown`, so every client renders the same thing: a heading `Quote <quoteId> v<version> — <status>`, one bullet per line item `- <label>: <formatUsd(amountCents)> (<rationale>)`, `Total: <formatUsd(totalCents)>`, `Delivery: <deliveryDays> days`, the explanation, and for `needs_info` a `Questions:` list of `- <question> (<whyItChangesPrice>)`.

- [ ] **Step 1: Write failing tests.** `format.test.ts`: `formatQuoteMarkdown` of a quote with one line of 6000 contains `US$60.00` and the label; a `needs_info` quote lists its question. `server.test.ts` (one harness per file, `createHarness({ agent: fakeAgentPort() })`, `createApp`, token from `issueAgentToken(h.deps.db, { clientId: DEMO.client.id, label: 'Test agent', mandateId: DEMO.mandate.id })`, client built as in the verified block): (a) `listTools()` returns exactly `MCP_TOOL_NAMES` (sorted compare); (b) `request_quote` for `DEMO.project.id` with text `Alert me by email when any branch's daily sales drop more than 20%.` → `structuredContent.quote.totalCents === 6000` and `status 'published'`; (c) after `activateMandate(h.deps)`, `accept_quote` on that quote and version → `structuredContent.status === 'paid'` and `payment.status === 'captured'`; (d) `request_quote` with text `Add our Amazon sales as a second source.` (19000, above the 10000 per-purchase limit) then `accept_quote` → `status 'approval_required'` with an `approvalUrl` string; (e) `request_quote` with `text: ''` rejects with `/text is required/` and the project still has the same number of quotes; (f) `get_project` for a project of another client → `isError: true` and text `project not accessible` (insert a second client and project as `app.test.ts` does for its foreign business); (g) `readResource({ uri: `quote://${quoteId}` })` → `contents[0].text` contains `US$60.00`; (h) unknown token `dwa_` + 43 `a`s → `connect` rejects `/401/`; (i) a revoked token (`revokeAgentToken`) → `/401/`; (j) the capability URL form `new URL('http://mcp.test/mcp/' + token)` with no header lists the same eight tools; (k) `get_mandate` → `structuredContent.mandate.id === DEMO.mandate.id`.
- [ ] **Step 2: Run** `pnpm --filter @dealingwith/backend exec vitest run src/mcp` → FAIL (modules missing).
- [ ] **Step 3: Install and implement.** `pnpm add --filter @dealingwith/backend @modelcontextprotocol/sdk@1.32.2 @hono/mcp@0.3.5`; write `clients.ts`, `scope.ts`, `format.ts`, `tools.ts`, `server.ts`, `routes.ts`; mount in `app.ts`.
- [ ] **Step 4: Run** the same command → PASS; then `pnpm lint && pnpm typecheck && pnpm test` from the worktree root → green, 47+ files.
- [ ] **Step 5: Commit** `feat(mcp): streamable HTTP server with scoped tools and quote resource`, tick the M3 C1 line in the same commit, push.

### Task C2: MCP docs and verified client snippets

**Files:**
- Create: `docs/mcp.md`, `apps/backend/scripts/mcp-smoke.mjs` (SDK client script: lists tools and calls `list_services` against `MCP_URL` with `MCP_TOKEN`; used when `claude` is not installed and for the Render check later)
- Modify: `apps/backend/src/access/snippets.ts` (only if a client's syntax differs from the current strings), `apps/backend/package.json` (script `mcp:smoke`)

- [ ] **Step 1: Verify** the three snippet forms against the clients' current documentation on the day (Claude Desktop custom connectors: URL only; Claude Code `claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"`; Cursor `mcp.json` with `url` and `headers`). Record the verification date and the doc URLs in `docs/mcp.md`. If a form changed, edit `snippets.ts` and its test.
- [ ] **Step 2: Write `docs/mcp.md`:** what the server exposes, auth (header and capability URL, both revocable from the portal, OAuth named as the production path), the eight tools with one example call and response each, the `accept_quote` contract, the `quote://` resource, limits (stateless, no SSE resumption, 2000-character requests).
- [ ] **Step 3: Live check locally.** Start the backend from the worktree: `PORT=3002 APP_URL=http://localhost:3002 pnpm dev` (mock PayPal, demo seed). Issue a token: `POST http://localhost:3002/api/session/login {"role":"client"}` then `POST /api/agents {"label":"Local check"}` with the cookie; copy `token`. Then either `claude mcp add --transport http dealingwith http://localhost:3002/mcp --header "Authorization: Bearer <token>"` and ask Claude Code "list the services of my provider", or `MCP_URL=http://localhost:3002/mcp MCP_TOKEN=<token> pnpm --filter @dealingwith/backend mcp:smoke`. Paste the result (tool names and the three service names) in `docs/mcp.md` and in your report. Never paste the token anywhere.
- [ ] **Step 4: Commit** `docs(mcp): connection guide verified against Claude Code` (or `…verified with the SDK client`), tick the M3 C2 line, push.

---

## Phase 1 — Track D: web (`apps/web`)

Revised 2026-11-07 by the integrator (fool-proof revision, anchored to the contracts and the A7 route table on `main`). Nothing of `apps/web` exists yet; D1 creates it. The backend on `main` has no HTTP API until Track A merges, so the web is built and reviewed in **fixtures mode** first and switched to the real API when the integrator announces A7 on `main`.

**Preflight numbers.** `main` at the commit that carries this revision (`git log --oneline -1` mentions "Track D") or later; `pnpm test` there reports 11 test files and 44 tests. Branch `track/d`, worktree `../dealingwith-track-d`, report `dealingwith-reports/track-d.md`. Port `5173`. Never run the root `pnpm dev` here (it also starts the backend on `3000`, which belongs to Track A); run `pnpm --filter @dealingwith/web dev`. When the integrator says A7 is on `main`: `git merge main` in the worktree (a merge commit, never a rebase), then `PORT=3001 APP_URL=http://localhost:5173 pnpm --filter @dealingwith/backend dev` for the manual checks with `VITE_API_MODE=http` and `VITE_API_PROXY=http://localhost:3001`.

**Read first for this track**, after the general list above: spec sections 5 (stack, AG Studio), 6 (demo scenario: the exact requests and amounts), 7.7 (web); Task A7's route table (the API you consume; copy paths verbatim); `packages/contracts/src/{api,access,events,quote,mandate,payment,catalog,scope,money}.ts` (every shape you render or fake); `apps/backend/src/db/demo-data.ts` (ids, names, clause texts, rule labels; your fixtures reuse them verbatim); the five rows of Task A7's demo-output table (labels of the quote lines). Load the `frontend-design` skill before D1 and keep one visual system (type scale, 8-pt spacing, one accent color, light theme) across every page.

**Files you may touch, and nothing else:** `apps/web/**`; `docs/milestones.md` (M4 lines); `docs/decisions/` (new files plus their line in `docs/decisions/README.md`). No root file changes are needed: `apps/*` is already a workspace and a Vitest project, and the root `typecheck`/`build` scripts pick up `apps/web/package.json` scripts. Never: `packages/contracts`, `apps/backend`, root `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `biome.json`, `tsconfig.base.json`.

**Decisions already taken (do not reopen; build on them):**

- Stack, versions verified on npm 2026-11-07: `vite 8.3.6`, `@vitejs/plugin-react 6.2.1` (peer `vite ^8`), `react` and `react-dom 19.3.1`, `react-router 7.18.5` (the `react-router` package, declarative `<BrowserRouter>` + `<Routes>`; not v8), `@paypal/react-paypal-js 10.6.1`, `ag-studio-react 3.1.0` (brings `ag-grid-react` and `ag-grid-enterprise ~36.3`), dev: `jsdom 31.0.0`, `@testing-library/react 16.3.3`, `@testing-library/jest-dom 7.0.1`, `@types/react 19.3.0`, `@types/react-dom 19.3.0`. Vitest stays the root `^5.1.0` (it accepts `vite ^8`, so one Vite copy). `pnpm add --filter @dealingwith/web` in one command per group so the lockfile resolves once.
- Styling: plain CSS. Design tokens as custom properties in `src/styles.css`, one CSS Module per component (`Button.module.css`), no Tailwind, no UI kit (decision `docs/decisions/2026-11-07-web-plain-css.md`). Biome lints the CSS, so use standard syntax only.
- `apps/web/package.json`: name `@dealingwith/web`, private, `"type": "module"`, dependency `@dealingwith/contracts: workspace:*`, scripts `dev: vite`, `build: vite build`, `preview: vite preview`, `typecheck: tsc --noEmit -p tsconfig.json`. `apps/web/tsconfig.json` extends `../../tsconfig.base.json` and overrides only: `lib ["ES2022", "DOM", "DOM.Iterable"]`, `jsx "react-jsx"`, `module "ESNext"`, `moduleResolution "Bundler"`, `types ["vite/client"]`, `noEmit true`, `include ["src", "vite.config.ts", "vitest.config.ts"]`. Everything else (strict, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `customConditions ["development"]`) is inherited on purpose.
- `apps/web/vite.config.ts`: `plugins: [react()]`, dev proxy for `/api`, `/mock-paypal`, `/healthz` and `/mcp` to `process.env.VITE_API_PROXY ?? 'http://localhost:3000'` (`changeOrigin: false`, so the session cookie stays on the Vite origin). `apps/web/vitest.config.ts`: `plugins: [react()]`, `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`; `setup.ts` imports `@testing-library/jest-dom/vitest`. Tests are `*.test.ts` or `*.test.tsx` beside the code.
- API client (`src/api/client.ts`): `api.get(path, schema)` and `api.post(path, body, schema)` (plus `patch`, `del`) with `credentials: 'include'`, JSON bodies, and `schema.parse(await res.json())` on every 2xx so that drift from the contracts fails loudly; non-2xx throws `ApiRequestError { status, code, message, details? }` built from the contracts `ApiError` shape (`{ error: { code, message, details? } }`). The route list is one typed module, `src/api/routes.ts`, mirroring Task A7's table path by path; nothing calls `fetch` outside `client.ts`.
- Fixtures mode: `import.meta.env.VITE_API_MODE === 'fixtures'` makes `client.ts` route every call to `src/api/fixtures/handlers.ts` instead of `fetch`. The fixtures are an in-memory demo state (`src/api/fixtures/state.ts`) built from the demo data (business `Andes Data Studio`, services S1–S3 with the rules of `demo-data.ts`, client `Lukas Retail GmbH`, project P1 `Retail KPI dashboard` with C1–C3, mandate M1 pending; ids `a0000000-0000-4000-8000-0000000000NN` with 01/11/12/13/21/31/41 as in `demo-data.ts`). They are fixtures, not an engine: the five demo requests map by the same substrings as Task A7 (`summary email every Monday`, `Amazon sales as a second source`, `daily sales drop more than 20%`, `regional managers too`, `load faster`) to five hand-written `Quote` objects with the amounts of spec section 6 (`8000`; `15000 + 4000 = 19000`; `6000`; `0`; `needs_info`), and `Buy Analytics dashboard build` to a `120000` quote. Accept returns `{ status: 'approval_required', approvalUrl: '/pay/return?token=MOCK-ORDER-000001', payment }`; capture marks the payment `captured`, the quote `paid`, and appends clause `C4` `Weekly Monday summary email` (source `{ kind: 'quote', quoteId, version }`) to P1 so request 4 renders as included; mandate fund returns `approvalUrl: '/portal/mandates/<id>/funded?token=MOCK-ORDER-000002'` and complete sets `active` with `funding.fundingAmountCents`; issue agent returns a token matching `AGENT_TOKEN_PATTERN` plus three snippet strings; dashboard data derives rows from the state; reset restores the initial state. Every fixture object is validated against its contracts schema in `fixtures.test.ts`, so a fixture can never drift from the API.
- Money: `formatUsd(cents)` from `@dealingwith/contracts` (`US$80.00`, `US$1,234.50`, `US$0.00`); `<Money cents />` renders it. The web never computes a price; it shows `amountCents`, `subtotalCents`, `totalCents` from the quote.
- Session: `useSession()` reads `GET /api/me` once (401 → no session), `loginAs('client' | 'provider')` posts `/api/session/login` and then, for a client, `GET /api/projects` and navigates to `/portal/projects/<first project id>`; for a provider, `/dashboard`. Protected routes redirect to `/login`. The cookie is `HttpOnly`; the web never reads it.
- Live updates: `useProjectEvents(projectId, onEvent)` opens `new EventSource('/api/events?projectId=' + id)` (same origin: Vite proxy in dev, the backend's static server in production), parses `event.data` with `DomainEventSchema`, and refetches the `ProjectView` on `quote.published`, `quote.needs_info`, `quote.paid`, `payment.approval_required` and `mandate.updated`. It is a no-op when `typeof EventSource === 'undefined'` (jsdom) or in fixtures mode.
- PayPal: `<PayWithPayPal>` reads `AppConfig` from `GET /api/config`. `paypalMode === 'sandbox'` with a `paypalClientId` → `PayPalScriptProvider options={{ clientId, currency: 'USD' }}` and `PayPalButtons` (`createOrder` → `POST /api/quotes/:id/accept { version }` → `payment.paypalOrderId`; `onApprove` → `POST /api/paypal/orders/:orderId/capture`). `paypalMode === 'mock'` → one button `Approve in mock PayPal` that calls accept and does `window.location.assign(approvalUrl)`. The mock approve page returns to `/pay/return?token=<orderId>&PayerID=MOCKPAYER01`.
- AG Studio from day one: `ag-studio-react` installs and renders without a license key in trial mode (`ag-studio@3.1.0` ships trial and watermark handling; the README's trial key removes them). Names verified in the published type declarations (2026-11-07): wrap the page in `<AgStudioProvider licenseKey={import.meta.env.VITE_AG_STUDIO_LICENSE || undefined}>` (from `ag-studio-react`; omit the prop when empty); `<AgStudio data mode="edit" initialState theme onStateUpdated />` where `data` is `{ sources: [{ id, data: Row[] }] }`, `initialState?: AgReportState` is the saved dashboard definition (build the four widgets once in the editor, capture the state from `onStateUpdated(event)` into `src/dashboard/studio-config.ts`, ship it as `initialState`), `theme?: AgStudioTheme` carries the product tokens, and `widgets`/`page`/`layout` exist for finer control. The widget AI features need `modules={[AgStudioAiModule]}` and are a stretch, not the MVP. The pivot rule of spec section 5 narrows to: only if AG Studio does not render at all without a key by 2026-11-09 20:00 Santiago, implement the four widgets with `ag-grid-community` + `ag-charts-react` in `src/dashboard/fallback/` (decision `docs/decisions/2026-11-07-ag-studio-trial-first.md`).
- Dashboard data: `toStudioSources(data: DashboardData)` returns `{ sources: [{ id: 'quotes', data }, { id: 'lines', data }, { id: 'payments', data }, { id: 'requests', data }] }` (AG Studio takes arrays of flat plain objects per source). Each row keeps its cents fields and gains `amountUsd: amountCents / 100` (and `totalUsd` for quotes) for charting only; this is display, not pricing. The four widgets of spec section 7.7 are preconfigured through whatever the installed Studio version documents for loading a saved dashboard definition (a JSON exported from the editor is acceptable), themed from `src/dashboard/theme.ts` with the product tokens.
- Copy, exact strings (spec sections 6 and 7.7): `Enter as client (Mara)`, `Enter as provider (Andes Data Studio)`, `Describe what you need`, `Buy`, `Quote v{n}`, `Included`, `Source: clause {id}`, `Rule {id}.v{version}`, `{n} day(s)` (`1 day`, `5 days`), `Ask for an adjustment`, `Accept and pay with PayPal`, `Send answers`, `Approve in mock PayPal`, `Authorize with PayPal`, `Re-authorize`, `Spent {x} of {y}`, `Backed by PayPal authorization`, `Connect my agent`, `Revoke`, `Reset demo data`, `Payment cancelled`, `Paid {amount} · Quote v{n} · Capture id {id}`, `Added from quote v{n} on {date}`. Everything else in plain English, sentence case, no exclamation marks.

**Track D traps:**

- `vite build` resolves `@dealingwith/contracts` with the `production` condition, which points at `packages/contracts/dist`. Run `pnpm --filter @dealingwith/contracts build` first (the root `pnpm build` orders it by dependency). Dev, tests and `tsc` use the `development` condition and read the source.
- `exactOptionalPropertyTypes` bites React props: `<Badge tone={maybeUndefined} />` fails when `tone?: Tone`. Spread conditionally (`{...(tone ? { tone } : {})}`) or make the prop required.
- `verbatimModuleSyntax`: `import type { Quote } from '@dealingwith/contracts'` for types, plain `import` for schemas and functions.
- Without `apps/web/vitest.config.ts` the root Vitest runs the web tests in Node, where `document` does not exist; the error looks like a React bug. Check "Test Files" after every run: the count must grow with your tests.
- The mock approve page redirects to `APP_URL/pay/return`; running the real backend for D needs `APP_URL=http://localhost:5173`, otherwise the redirect lands on `3001` with no web served.
- `ag-studio-react` pulls `ag-grid-enterprise` (several MB): import the dashboard page with `React.lazy` so the storefront and the project page stay light. Studio fills its parent: give the container an explicit height (`calc(100vh - header)`).
- jsdom has no `EventSource`; the hook must guard it. `@paypal/react-paypal-js` must not load in tests or in mock mode: render it only in the sandbox branch.
- Biome's recommended rules flag `dangerouslySetInnerHTML`, array index keys and missing `type="button"`; fix the code, do not disable rules. `pnpm lint:fix` first when the diff is large.
- Demo ids live in `demo-data.ts` as `id(n)`; copy the resulting UUIDs into one `src/api/fixtures/demo-ids.ts` and reference them from there only.

**Definition of done for the track, all true before you report it done:** D1–D6 committed and pushed on `track/d`; `pnpm lint && pnpm typecheck && pnpm test` green from the worktree root with the web project counted in "Test Files"; `pnpm --filter @dealingwith/contracts build && pnpm --filter @dealingwith/web build` succeeds; in fixtures mode a fresh browser at `http://localhost:5173` walks the five demo requests of spec section 6 (quote card, mock approval, receipt, included line, needs-info form), funds the mandate, issues and revokes an agent and opens the dashboard, with one screenshot per page saved to `dealingwith-reports/track-d/` and listed in the report; after A7 is on `main` and merged into `track/d`, the manual checks of D2–D6 pass against the real backend with `PAYPAL_MODE=mock` and the report says so; GitHub Actions green on the last push; M4 lines ticked; the report ends with `STATUS: DONE`.

### Task D1: Vite app, routing, session, API client, fixtures mode, design tokens

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app.tsx` (routes `/`, `/login`, `/portal/projects/:id`, `/portal/mandates/:id/funded`, `/pay/return`, `/pay/cancel`, `/dashboard`), `apps/web/src/api/client.ts`, `apps/web/src/api/routes.ts`, `apps/web/src/api/hooks.ts`, `apps/web/src/api/fixtures/{demo-ids,state,quotes,handlers}.ts`, `apps/web/src/session.tsx`, `apps/web/src/styles.css`, `apps/web/src/components/{Button,Card,Money,Badge,Layout}.tsx` with their `.module.css`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/test/setup.ts`
- Test: `apps/web/src/components/Money.test.tsx`, `apps/web/src/api/client.test.ts`, `apps/web/src/api/fixtures/fixtures.test.ts`

**Interfaces:**
- Produces: `api.get<T>(path, schema: ZodType<T>)`, `api.post<T>(path, body, schema)`, `api.patch`, `api.del`, `ApiRequestError`; `routes` with one typed entry per A7 row (`routes.projects.get(id)`, `routes.quotes.accept(id)`…); `useSession()` → `{ session: Session | null, status: 'loading' | 'ready', loginAs(role), logout() }`; `<Money cents={8000} />` → `US$80.00`; `useApi<T>(fetcher)` → `{ data, error, loading, refetch }`. `<Layout>` shows `Reset demo data` in the header whenever the session is `provider` and `AppConfig.demoMode` is true (confirm dialog `This restores the demo to its starting state. Continue?` → `POST /api/demo/reset` → reload), so judges can reset from any page, not only the dashboard (critique 2026-11-07).

- [ ] **Step 1: Write failing tests.** `Money.test.tsx`: `cents 8000` → text `US$80.00`; `cents 0` → `US$0.00`; `cents 123450` → `US$1,234.50`. `client.test.ts` (mock `fetch`): a 2xx body that fails the schema throws a `ZodError`; a `404 { error: { code: 'not_found', message: 'Quote not found' } }` throws `ApiRequestError` with `status 404`, `code 'not_found'`, `message 'Quote not found'`. `fixtures.test.ts`: every fixture quote parses with `QuoteSchema`; the initial project view parses with `ProjectViewSchema`; `AppConfig`, `Session` (both roles), `Mandate`, `IssuedAgent` (token matches `AGENT_TOKEN_PATTERN`) and `DashboardData` fixtures parse; after `accept` + `capture` of request 1 the project has 4 clauses and the fourth has `source.kind 'quote'`.
- [ ] **Step 2: Run** `pnpm --filter @dealingwith/web test` → FAIL (first because the package does not exist; then for the right reasons). **Step 3: Scaffold and implement** (`pnpm create vite` React + TS template is allowed as a starting point; delete what you do not use). **Step 4: Run** → PASS; `pnpm lint && pnpm typecheck` green from the root; `VITE_API_MODE=fixtures pnpm --filter @dealingwith/web dev` shows the login page at `http://localhost:5173/login`, and `Enter as client (Mara)` lands on `/portal/projects/a0000000-0000-4000-8000-000000000031`.
- [ ] **Step 5: Commit** `feat(web): Vite app, routing, demo session, typed API client, fixtures mode and design tokens` and push; tick D1.

### Task D2: Storefront `/`

**Files:**
- Create: `apps/web/src/pages/StorefrontPage.tsx`, `apps/web/src/components/ServiceCard.tsx`, `apps/web/src/components/PayWithPayPal.tsx`, `apps/web/src/components/RequestBox.tsx`
- Test: `apps/web/src/components/PayWithPayPal.test.tsx`

**Interfaces:**
- Produces: `<PayWithPayPal quoteId version amountCents onPaid />` as decided above (sandbox → PayPal buttons; mock → `Approve in mock PayPal`); `<RequestBox onSubmit(text) placeholder="Describe what you need" />`; `<ServiceCard service onBuy? />` with name, description, the price of the `fixed` rule when the service has exactly one (`US$1,200.00`), inclusions and exclusions, and `Buy` only for that case. Storefront: business header, the three services, `Buy` on S1 (creates a request with text `Buy ${service.name}` via `POST /api/requests` → quote → `PayWithPayPal`), and the request box → quote card (D3 component, rendered inline).

- [ ] **Step 1: Write failing test** `PayWithPayPal.test.tsx`: with `paypalMode 'mock'` renders a button named `Approve in mock PayPal`; clicking it calls accept and assigns `approvalUrl` to `window.location` (spy); with `paypalMode 'sandbox'` and a client id, renders the PayPal container and no mock button.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; in fixtures mode `/` shows the three services and `Buy` on S1 leads to `/pay/return?token=MOCK-ORDER-000001` and a receipt (D5 can be a placeholder until D5 lands).
- [ ] **Step 5: Commit** `feat(web): storefront with direct purchase` and push; tick D2.

### Task D3: Project page and quote card (hero)

**Files:**
- Create: `apps/web/src/pages/ProjectPage.tsx`, `apps/web/src/components/ScopeList.tsx`, `apps/web/src/components/QuoteCard.tsx`, `apps/web/src/components/NeedsInfoForm.tsx`, `apps/web/src/hooks/useProjectEvents.ts`
- Test: `apps/web/src/components/QuoteCard.test.tsx`, `apps/web/src/components/ScopeList.test.tsx`

**Interfaces:**
- Produces: `<QuoteCard quote onAccept onAdjust onAnswers />`: header `Quote v{version}` + status badge; one row per `lineItems` entry: `label`, for `kind 'included'` the badge `Included` and `US$0.00`, for `kind 'rule'` the amount (`quantity × unit` shown when `quantity > 1`), `rationale`, an expandable source line (`Source: clause C1` from `scopeRef`, or `Rule S2.report.v1` from `ruleRef.id` and `ruleRef.version`); delivery `{deliveryDays} day(s)`; `explanation`; total; actions `Ask for an adjustment` (free-text box that posts to `POST /api/quotes/:id/answers { answers: { adjustment: text } }`) and `Accept and pay with PayPal` (`PayWithPayPal`) when `status === 'published'`. `needs_info` quotes render each `needsInfo[].question` with an input, `whyItChangesPrice` as help text, and `Send answers`. `<ScopeList clauses />` separates `source.kind 'contract'` from `source.kind 'quote'` (`Added from quote v{version} on {date}`) and shows excluded clauses struck through with `Excluded`. The page: project title, service name, `ScopeList`, request box, the quotes newest first, and `useProjectEvents` wired to refetch.

- [ ] **Step 1: Write failing tests.** `QuoteCard.test.tsx` with the fixture quote of demo request 1: shows `Per-branch view` with `Included` and `US$0.00`, `Weekly Monday summary email` with `US$80.00`, `1 day`, a total `US$80.00`, and the buttons `Ask for an adjustment` and `Accept and pay with PayPal`; expanding the second line shows `Rule S2.report.v1`; the needs-info fixture (request 5) shows `Is the slowness caused by data volume or by the dashboard design?` and `Send answers`. `ScopeList.test.tsx`: three contract clauses plus one quote-sourced clause render in two groups and C2 shows `Excluded`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; in fixtures mode request 1 goes quote → mock approval → receipt → back on the project page C4 is listed under paid additionals and request 4 renders as included.
- [ ] **Step 5: Commit** `feat(web): project page with explained quote card and live updates` and push; tick D3.

### Task D4: Mandate panel and "Connect my agent"

**Files:**
- Create: `apps/web/src/components/MandatePanel.tsx`, `apps/web/src/components/ConnectAgent.tsx`, `apps/web/src/components/CopyField.tsx`
- Test: `apps/web/src/components/MandatePanel.test.tsx`, `apps/web/src/components/ConnectAgent.test.tsx`

**Interfaces:**
- Produces: `<MandatePanel mandate projectId onChange />`: without a mandate, a form (per purchase, total, expiry date) → `POST /api/mandates { projectId, perPurchaseLimitCents, totalLimitCents, expiresAt }`; with one: status badge, `Spent {formatUsd(spentCents)} of {formatUsd(totalLimitCents)}`, per-purchase limit, expiry, `Authorize with PayPal` (amount input, default `US$2,000.00` = `200000`) → `POST /api/mandates/:id/fund { fundingAmountCents }` → `window.location.assign(approvalUrl)`; when `funding.paypalAuthorizationId` exists: `Backed by PayPal authorization` with headroom `formatUsd(fundingAmountCents - fundingCapturedCents)`; `Re-authorize` when headroom `< perPurchaseLimitCents`; the list of `mode 'mandate'` payments from the `ProjectView`. `<ConnectAgent agents onChange />`: `Connect my agent` → label input → `POST /api/agents { label, mandateId? }` → shows the token once with the warning `Copy it now; it is not shown again.`, three `CopyField`s titled `Claude Desktop`, `Claude Code`, `Cursor` from `snippets`, and the list of agents (`label`, `createdAt`, `lastUsedAt`) with `Revoke` → `DELETE /api/agents/:id`. `<CopyField label value />` copies with `navigator.clipboard.writeText` and shows `Copied`.

- [ ] **Step 1: Write failing tests.** `MandatePanel.test.tsx`: fixture M1 pending → `Spent US$0.00 of US$300.00` and `Authorize with PayPal`; the funded fixture (active, `fundingAmountCents 200000`, `fundingCapturedCents 0`) → `Backed by PayPal authorization` and `US$2,000.00`; a funded fixture with headroom `9000` → `Re-authorize`. `ConnectAgent.test.tsx`: after `Connect my agent` + label + submit, the token (`dwa_…`) and the three field titles are visible; after `Revoke` the agent disappears.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; in fixtures mode: create mandate → `Authorize with PayPal` → funded page → panel shows `active` and `US$2,000.00`; issue token → snippets render; revoke → agent gone.
- [ ] **Step 5: Commit** `feat(web): mandate panel and connect-my-agent` and push; tick D4.

### Task D5: Return pages

**Files:**
- Create: `apps/web/src/pages/PayReturnPage.tsx`, `apps/web/src/pages/PayCancelPage.tsx`, `apps/web/src/pages/MandateFundedPage.tsx`
- Test: `apps/web/src/pages/PayReturnPage.test.tsx`

**Interfaces:**
- Produces: `/pay/return?token=<orderId>` → `POST /api/paypal/orders/:orderId/capture` → receipt `Paid {formatUsd(amountCents)} · Quote v{quoteVersion} · Capture id {paypalCaptureId}` with a link `Back to project` (to `/portal/projects/:projectId` when the quote has one, else `/`); `/pay/cancel` → `Payment cancelled` with a link back; `/portal/mandates/:id/funded?token=<orderId>` → `POST /api/mandates/:id/fund/complete { orderId }` → redirect to the project page. Every page has loading and error states (an `ApiRequestError` shows its `message`).

- [ ] **Step 1: Write failing test** `PayReturnPage.test.tsx`: with a captured fixture payment of `8000` renders `Paid US$80.00 · Quote v1 · Capture id MOCK-CAPTURE-000001`; a failing capture renders the error message.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; both return paths work in fixtures mode.
- [ ] **Step 5: Commit** `feat(web): PayPal return pages` and push; tick D5.

### Task D6: Provider dashboard with AG Studio

**Files:**
- Create: `apps/web/src/pages/DashboardPage.tsx` (lazy-loaded), `apps/web/src/dashboard/sources.ts`, `apps/web/src/dashboard/studio-config.ts` (saved dashboard definition), `apps/web/src/dashboard/theme.ts`, `apps/web/src/dashboard/license.ts`, `apps/web/src/dashboard/fallback/*.tsx` (only if the pivot triggers)
- Test: `apps/web/src/dashboard/sources.test.ts`

**Interfaces:**
- Produces: `toStudioSources(data: DashboardData)` as decided above; `/dashboard` (provider session) loads `GET /api/dashboard/data`, renders `<AgStudio data={toStudioSources(data)} mode="edit" />` inside a full-height container with the four widgets preconfigured: revenue by service (bar over `lines` where `quoteStatus === 'paid'`, sum of `amountUsd` by `serviceName`), quotes pipeline by status (stacked bar over `quotes` by `status` and `channel`), unpaid additionals (grid over `lines` with `kind === 'rule'` and `quoteStatus` in `published`/`accepted`), requests over time (line over `requests` by `createdAt` day); theme from `theme.ts`; `applyLicense(import.meta.env.VITE_AG_STUDIO_LICENSE)` runs once before the first render when the key is non-empty; a header with the remaining budget of the demo mandate (`formatUsd(totalLimitCents - spentCents)`) and `Reset demo data` → confirm dialog (`This restores the demo to its starting state. Continue?`) → `POST /api/demo/reset` → reload the data.

- [ ] **Step 1: Write failing test** `sources.test.ts`: the dashboard fixture yields four sources with ids `quotes`, `lines`, `payments`, `requests`; a line row with `amountCents 8000` has `amountUsd 80`; cents fields are kept.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`AgStudioProvider licenseKey`, `initialState` from the captured `onStateUpdated` state, `theme`; names above are verified, confirm them against `node_modules/ag-studio-react/dist/types/src/*.d.ts` and `node_modules/ag-studio/dist/types/api/agStudioBaseProperties.d.ts`). **Step 4: Run** → PASS; in fixtures mode the dashboard renders the four widgets, paying request 1 makes revenue show `80`, and reset returns it to zero. **Step 5: Pivot check** at 2026-11-09 20:00 Santiago if and only if Studio does not render without a key.
- [ ] **Step 6: Commit** `feat(web): provider dashboard with AG Studio` and push; tick D6.

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

Note (critique 2026-11-07): webhook headers reach Hono lowercase (`paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`); map `captureAuthorization`'s `invoiceId` to PayPal's `invoice_id`; `PAYPAL_WEBHOOK_ID` is optional (A9) so the smoke script runs before I2; events from PayPal's webhook simulator cannot be signature-verified, only real ones can.

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

Note (critique 2026-11-07): the sandbox webhook can only be registered once the public URL exists, so deploy first with `PAYPAL_WEBHOOK_ID` empty (A9 makes it optional; every webhook is rejected until it is set), register the webhook for `https://<service>.onrender.com/api/webhooks/paypal`, then set the id and redeploy. Render must run the root `pnpm build` (contracts before backend before web); a package-level backend build fails without `packages/contracts/dist`.

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

Note (critique 2026-11-07): judging runs 2026-12-01 14:00 PST to 2026-12-15 08:00 PST. A PayPal authorization lives 29 days (3-day honor period), so the demo mandate's funding authorized on 2026-11-11 would die around 2026-12-10. Re-authorize the US$2,000 funding on 2026-11-30 (Walter, from the client portal), and write that date in the README and in `docs/milestones.md`.

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

- **Independent critique (2026-11-07 evening).** Two reviewers (top 1% bar, CTO for delivery) read spec, plan and the Track A/B code; the integrator verified each finding at file and line before acting. Verified and scheduled: Task A9 (approval instead of denial, capture without a cookie, expired orders, deterministic fixed-price purchase, no 422 for a human request, mandate on the payment, reconcilable mandate captures, optional webhook id); contracts gained `Payment.mandateId`, `scopeRef` on rule intents and `serviceId` on quote requests; D1 shows reset in the provider header; I4 deploys before the webhook; I5 re-authorizes funding before judging. Pending Walter: a single approve-link payment path for the web (no PayPal JS buttons in the MVP) and the weekend calendar for the sandbox spike. Not adopted yet: a "Why was this paid?" trace endpoint and drawer (good idea, after the tracks are green).

- **Fool-proof revision (2026-11-07, after Track A started).** The plan, not the chat brief, carries the preflight (expected results per step, ports per track), the bugs rule, the report file with `STATUS: DONE`, the stack traps, and per track the files it may touch, the decisions already taken and the track's definition of done. A brief to a session can then be three lines: the track, the plan, the decision rule. Tracks B, C and D are revised this way. Track C additions verified 2026-11-08 from the tarballs of `@modelcontextprotocol/sdk@1.32.2` and `@hono/mcp@0.3.5`: `registerTool` accepts Zod 4 object schemas directly, input validation failures are JSON-RPC errors (not `isError` results), the client transport takes a custom `fetch`, so tests run against `app.request` without a port. Untested: Claude Desktop against a stateless server from a public URL (spike 3). Track D additions verified on npm 2026-11-07: `ag-studio-react@3.1.0` exists and its README says the trial key removes watermarks (so keyless mode renders), `@vitejs/plugin-react@6.2.1` needs `vite ^8`, `vitest@5.1.0` accepts `vite ^8`. Untested: AG Studio's saved-definition and license entry points (D6 records what it finds). Verified: the AI SDK 7 names in the Track B introduction were read from the published tarballs (`ai@7.0.165`, `@ai-sdk/anthropic@4.0.99`, `@ai-sdk/openai@4.0.111`), not run. Untested: `MockLanguageModelV4` with `Output.object` end to end; the first green `run.test.ts` is the proof.

- Spec coverage: G1 → T4, A7, I4; G2 → A1–A5, A7, D3, D5; G3 → A3, A5, C1, I4; G4 → A6, C2, D4; G5 → D6; G6 → D2; G7 → A4, A5, A8, T1 CI (the five scenarios are `tests/scenarios/01…05`); G8 → T1, E2, S1–S3. Non-goals respected (no auth, no multi-tenant UI, no Vault beyond the 30-minute probe in I1).
- The five scenario tests of spec 7.8 live in `tests/scenarios/` (Task A8, revised 2026-11-07), end to end through the HTTP API with the fixed demo outputs of `demo-agent-outputs.ts`; Track C extends scenario 3 with the real MCP tool once C1 lands.
- Type consistency checked: `AcceptQuoteResult`, `PolicyDecision`, `PaypalGateway`, `Deps`, `ContextPack`, `runAgent`, `issueAgentToken` names are used identically across A5, A7, C1, D3, D4.
- Proportion: plan ≈ 2× the spec; code bodies appear only for the gateway interface and the `accept_quote` description, both fixed by the spec.
