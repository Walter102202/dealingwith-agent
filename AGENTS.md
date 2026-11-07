# AGENTS.md

Conventions for coding agents (and humans) working in this repository.

## Purpose

DealingWith Agent turns service requests into paid work. A service business publishes its services and pricing rules once; clients, or their AI agents, ask for work in plain language; the agent interprets the request against the contracted scope, prices it with deterministic rules, explains the price, and the client pays with PayPal. Humans use the web, agents use our MCP server, and both operate on the same versioned quotes and payments. The approved spec is `docs/design/2026-11-07-dealingwith-agent-mvp-design.md`; the implementation plan is `docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md`; progress is tracked in `docs/milestones.md`.

## Repo map

- `apps/backend/` — one Node process (Hono): JSON API, MCP endpoint, PayPal webhooks, static web. Contains `src/db` (Drizzle schema, client, seed), `modules/` (quotes, policies, payments), `integrations/paypal`, `agent/`, `mcp/`.
- `apps/web/` — React + Vite client: storefront, portal, project page, provider dashboard (created in Phase 1).
- `packages/contracts/` — `@dealingwith/contracts`: Zod schemas and money helpers shared by backend, web and MCP. Consumed from source in development, built to `dist/` for production.
- `packages/ui/` — shared UI components (only if the MCP Apps stretch is built).
- `tests/` — the five scenario tests (`tests/scenarios/`).
- `evals/` — live model eval (`pnpm eval:live`), not part of CI.
- `docs/` — design, plan, milestones, roadmap, decisions, MCP guide, demo script. `docs/hackathon/` is local analysis and is git-ignored.
- `infra/` — Render Blueprint and deployment notes.
- `.github/workflows/` — CI: lint, typecheck, test on every push.

## Commands

```bash
pnpm install                                  # install every workspace
pnpm dev                                      # backend with tsx watch (web joins in Phase 1)
pnpm test                                     # vitest run, all workspaces
pnpm lint                                     # biome check .
pnpm typecheck                                # tsc --noEmit in every package
pnpm build                                    # build every package to dist/
pnpm --filter @dealingwith/backend seed       # seed the demo data into DATABASE_URL
pnpm eval:live                                # live model eval (needs an API key)
```

## Rules that never bend

- Money is integer **cents** (`amountCents: number`), currency always `USD`. Conversion to PayPal strings (`"80.00"`) happens only inside `integrations/paypal`.
- The model never computes a price. Any amount in model output is ignored; amounts come only from the pricing engine.
- Accept and pay always reference `(quoteId, version)`; only the latest `published` version is acceptable.
- Every PayPal creating call sends `PayPal-Request-Id` equal to our idempotency key.
- Every webhook is signature-verified and deduplicated on `paypal_event_id`.
- Everything committed is in English: code, comments, docs, UI copy.
- No secrets in the repo. `.env` is ignored; `.env.example` carries names and mock defaults only.
- `docs/hackathon/` is never committed. If `git status` shows it, fix `.gitignore` before anything else.

## The decision rule

When something is unclear, do not stop to ask Walter. Ask yourself what a top 1% software engineer would do here, decide, and write the decision down in `docs/decisions/` (one short file: context, decision, alternatives considered, consequences). Ask Walter only when the answer needs his credentials, his money, or changes what the product is. A question that only needs judgment is yours to answer.

## Decision log

Decisions live in `docs/decisions/`, one file per decision, named `YYYY-MM-DD-<slug>.md`, with the headings Context, Decision, Alternatives considered, Consequences. Never edit a past decision; write a new one that supersedes it and link both ways. Read the folder before re-opening anything that looks already decided. The format is described in `docs/decisions/README.md`.

## Definition of done

1. The tests named in the task exist and pass (`pnpm test` from the repo root is green).
2. `pnpm lint` and `pnpm typecheck` are green.
3. Committed and pushed; `docs/milestones.md` ticked in the same commit.
4. Any decision taken has a file in `docs/decisions/`.
5. A short report (what was built, test output tail, decisions, bugs fixed, anything the next task needs to know) is appended to `dealingwith-reports/track-<letter>.md` next to the repository (outside it) and pasted in the chat; the plan's "Reporting format" gives the fields.

## Where tests live

- Unit tests sit beside the code as `*.test.ts` (Vitest), in every package.
- The five scenario tests live in `tests/scenarios/` and run with fixed agent outputs against the real engine, policies and payment state machine.
- Backend tests use `createTestDb()` from `apps/backend/src/db/test-db.ts`: in-memory PGlite plus migrations, no external services.
- The live eval in `evals/` calls a real model and is run on demand, never in CI.
