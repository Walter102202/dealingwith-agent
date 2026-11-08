# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` first. It is the source of truth for the repo map, the rules that never bend (integer cents, the model never prices, `(quoteId, version)` everywhere, idempotent PayPal calls and webhooks, English only, `docs/hackathon/` never committed), the decision rule, the decision-log format and the definition of done. This file adds what `AGENTS.md` does not: how the pieces fit together and the commands beyond the basics.

## Commands

pnpm workspaces, Node 22, pnpm 10. Every command runs from the repo root with no build step and no credentials (`PAYPAL_MODE=mock`, `LLM_PROVIDER=mock`, embedded PGlite).

```bash
pnpm install
pnpm dev                    # backend :3000 (tsx watch) + Vite :5173 in parallel; open http://localhost:5173
pnpm test                   # vitest run over every project (contracts, backend, web, scenarios, evals graders)
pnpm lint && pnpm lint:fix  # biome check . (formatter + linter + import sorting)
pnpm typecheck              # tsc --noEmit in every workspace
pnpm build                  # contracts -> backend (tsc + copies src/agent/**/*.md into dist/agent) -> web (vite build)
```

Single tests:

```bash
pnpm vitest run apps/backend/src/modules/quotes/pricing.test.ts   # one file
pnpm vitest run --project @dealingwith/backend                      # one workspace: @dealingwith/{contracts,backend,web,scenarios}
pnpm vitest run tests                                               # the five scenarios
pnpm vitest run -t "stale version"                                  # by test name
```

Backend scripts (`pnpm --filter @dealingwith/backend <script>`):

- `db:generate` after editing `src/db/schema.ts` (drizzle-kit, `snake_case` casing, SQL written to `apps/backend/drizzle/`); `db:migrate` applies it to `DATABASE_URL`. The server also migrates on boot.
- `seed` seeds the demo data; the server seeds on boot when `DEMO_MODE=true`.
- `mcp:smoke` (needs `MCP_URL`, `MCP_TOKEN`) and `paypal:smoke` (sandbox credentials in `.env`) are manual checks documented in `docs/mcp.md` and `docs/paypal-notes.md`.
- `pnpm eval:live` (root) runs the five demo requests against a real model. Never in CI.

To run any TypeScript file by hand use `tsx --conditions=development <file>`; without the condition `@dealingwith/contracts` resolves to `dist/` (see "Shared contracts").

## How the code is wired

### One process, explicit dependencies

`apps/backend/src/index.ts` finds the root `.env` (cwd, `..`, `../..`), validates it with `env.ts` (Zod; every variable has a mock default), creates the DB, migrates, seeds, and assembles one `Deps` object (`workflows/deps.ts`: `db`, `paypal`, `events`, `env`, `now`, `logger`, `agent`). `createApp(deps)` in `api/app.ts` mounts every route group, `/mcp`, the mock PayPal approve page under `/mock-paypal` when in mock mode, and serves `apps/web/dist` statically. Only `index.ts`, `env.ts` and the two `*-cli.ts` scripts touch `process.env`; everything else receives `Deps`, which is why tests can build their own.

### Layers, top to bottom (a layer only calls the layers below it)

1. **Adapters** `api/routes/*` and `mcp/tools.ts`: validate input with contracts schemas, call a workflow, serialize. The MCP server is rebuilt per request (stateless Streamable HTTP); the agent token (`dwa_…`) arrives as `Authorization: Bearer` or in the `/mcp/:token` path, and `mcp/scope.ts` limits tools to that agent's client.
2. **Workflows** `workflows/`: the only place where side effects cross modules. `submit-request` (agent run, `priceIntents`, `createQuoteVersion`), `accept-quote` (branches to `pay-now` or the mandate path), `capture`, `mandate-funding`, `webhooks`, and the in-process `events` bus that `GET /api/events` streams as SSE.
3. **Modules** `modules/`: domain logic and repositories. `quotes/pricing.ts` is the deterministic pricing engine; `policies/evaluate.ts` and `policies/reserve.ts` gate agent spend under a row lock on the mandate; `payments`, `mandates`, `projects` (scope clauses stored as JSON), `requests`, `catalog`, `clients`, `dashboard`.
4. **Integrations** `integrations/paypal/`: the `PaypalGateway` interface with two implementations, `mock.ts` (own approve page, emits signed webhooks back into the process) and `sandbox.ts`. Cents become `"80.00"` strings only here.
5. **Agent** `agent/`: turns a request into `AgentOutput`, which holds intents and never amounts. `context/build.ts` builds the `ContextPack`; `prompts.ts` loads `instructions.md` and `skills/*.md`; `provider.ts` picks `anthropic` | `openai` | `mock` on the Vercel AI SDK; `run.ts` validates against `AgentOutputSchema`, retries once on a schema failure and records a row in `agent_runs`. `port.ts` exposes `AgentPort`; `workflows/fake-agent.ts` is the test double that answers from `demo-agent-outputs.ts`.

### Request to money, end to end

A request (web or MCP) produces agent intents: `included` with a `scopeRef` to a contract clause, or `rule` with a pricing-rule id. `priceIntents` prices them (included = US$0.00, rule = catalog amount x quantity, multiplier rules apply to the service base) and `createQuoteVersion` writes `(quote_id, version)`; a new version supersedes the previous one and only the latest `published` version can be accepted (`stale_version` otherwise). Accepting creates a payment whose `idempotency_key` is `pay:<quoteId>:<version>` or `mandate:<quoteId>:<version>` and doubles as the `PayPal-Request-Id`. Capture happens on the browser return or on the webhook, whichever arrives first, and both reach the same state. Paid lines are appended to the project as new scope clauses exactly once, so a later request that matches a paid clause comes back `included`. Agent accepts within a mandate return `paid`; a limit or mandate-state failure returns `approval_required` with a pay-now link; wrong project, currency or stale version is `denied`.

### Shared contracts, consumed from source

`@dealingwith/contracts` exports `.` with conditions `development` (`src/index.ts`), `types` and `default` (`dist/`). `tsconfig.base.json` sets `customConditions: ["development"]`, so tsc, Vitest and `tsx --conditions=development` all read the TypeScript source; only `apps/backend/tsconfig.build.json` clears it and resolves `dist/`. API request and response shapes, MCP tool I/O, domain events and `formatUsd` all live there, so a quote card on the web and an MCP result are the same object. Imports use `.js` extensions between `.ts` files (NodeNext).

### Database

Drizzle on Postgres. `createDb(url)` picks the driver from the scheme: `pglite://memory` (tests), `pglite://<dir>` (local default `.data/dev`), `postgres://` (Render). Eleven tables in `src/db/schema.ts`; migrations are checked-in SQL under `apps/backend/drizzle/`. `seedDemo` creates the demo world and `resetDemoData` restores it while keeping mandate funding and connected agents.

### Web

React 19, react-router 7, Vite, plain CSS with CSS Modules and design tokens (no UI framework). `src/api/client.ts` parses every response with a contracts schema. `VITE_API_MODE=http` proxies `/api`, `/mcp`, `/mock-paypal` and `/healthz` to `VITE_API_PROXY`; `fixtures` runs an in-browser fake API (`src/api/fixtures/`) through the same schemas. Vite reads the shared root `.env` and exposes only `VITE_*`. Routes live in `src/app.tsx`; the provider dashboard (AG Studio, lazy-loaded) shows a watermark without `VITE_AG_STUDIO_LICENSE`.

## Testing patterns

- **Backend**: `createTestDb()` (in-memory PGlite plus migrations) or `createHarness(overrides)` from `src/test/workflow-harness.ts`, which seeds the demo data, wires `MockPaypalGateway` so emitted webhooks flow back into `processWebhook`, fixes the clock, silences the logger, and installs an agent that throws unless you pass `fakeAgentPort()`. `publishedQuote` and `activateMandate` get a test to a payable state quickly. `DEMO` in `src/db/demo-data.ts` holds the seeded ids.
- **Scenarios** (`tests/scenarios/`): `createScenario()` builds the real Hono app with the fake agent and logged-in client and provider cookies, then drives HTTP with `app.request`. They and `evals/live/run.ts` import the backend by relative path (`../../apps/backend/src/...`); the backend is an application, not a library.
- **Web**: jsdom and Testing Library; `renderWithProviders` from `src/test/render.tsx`, session mocked per test.
- Backend and scenario projects run with `maxWorkers: 2` because parallel PGlite startups blow the timeout. Do not raise timeouts instead.
- The mock agent fixtures exist twice on purpose: `agent/mock-fixtures.ts` is the source, `evals/scenarios/fixtures/*.json` the mirror, and a backend test keeps them identical.

## Local gotchas

- One `.env` at the repo root serves backend and Vite. For the mock payment round-trip under `pnpm dev` set `APP_URL=http://localhost:5173`; the default `:3000` only serves a built web.
- `pnpm build` relies on pnpm's topological order to build `contracts` before `backend`. The backend build copies `src/agent/**/*.md` into `dist/agent` (`scripts/copy-prompts.mjs`) because tsc emits no Markdown; prompts stay Markdown so they can be reviewed as text.
- Biome, not ESLint or Prettier: single quotes, semicolons, trailing commas, line width 100, `noExplicitAny` is an error. tsc runs with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, so omit optional fields rather than passing `undefined`.
- `track/<letter>` branches are the parallel lanes from the plan; `main` is the integrated state. Task reports go to `../dealingwith-reports/track-<letter>.md`, outside the repo, in the format from the plan's "Reporting format" section.
