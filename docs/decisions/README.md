# Decisions

One file per decision, named `YYYY-MM-DD-<slug>.md`, with these headings in this order:

- **Context** — the question and why it had to be answered now.
- **Decision** — what was decided, in one or two sentences.
- **Alternatives considered** — what else was on the table and why it lost.
- **Consequences** — what this makes easier, what it makes harder, what to revisit.

Rules: one decision per file; never edit a past decision, write a new one that supersedes it and link both; read this folder before re-opening anything that looks decided. Decisions are made by whoever is doing the work when the answer only needs judgment (see the decision rule in `AGENTS.md`); Walter decides when it needs his credentials, his money, or changes what the product is.

## Index

- [2026-11-07 Scenario workspace Node types](2026-11-07-scenario-workspace-node-types.md)

- [2026-11-07 Agent port placeholder inside src](2026-11-07-agent-port-placeholder.md)

- [2026-11-07 Bound backend PGlite test workers](2026-11-07-bound-pglite-test-workers.md)

- [2026-11-07 Persist payment preparation before calling PayPal](2026-11-07-payment-reservation-before-gateway.md)

- [2026-11-07 Serialize quote versions on the request](2026-11-07-quote-version-allocation.md)

- [2026-11-07 TypeScript 5.9, not 7](2026-11-07-typescript-5-9.md)
- [2026-11-07 PGlite for tests and local default, pg for Render](2026-11-07-pglite-for-tests-and-local.md)
- [2026-11-07 Money as integer cents](2026-11-07-integer-cents.md)
- [2026-11-07 Contracts consumed from source via export conditions](2026-11-07-contracts-consumed-from-source.md)
- [2026-11-07 Seed creates, reset restores](2026-11-07-seed-creates-reset-restores.md)
- [2026-11-07 Reset keeps connected client agents](2026-11-07-reset-keeps-client-agents.md)
- [2026-11-07 API shapes live in contracts](2026-11-07-api-shapes-live-in-contracts.md)
- [2026-11-07 The agent module lives under src/agent](2026-11-07-agent-under-src.md)
- [2026-11-07 Web styling: plain CSS with design tokens and CSS Modules](2026-11-07-web-plain-css.md)
- [2026-11-07 AG Studio from day one, trial mode without a key](2026-11-07-ag-studio-trial-first.md)
- [2026-11-07 formatUsd lives in @dealingwith/contracts](2026-11-07-format-usd-in-contracts.md)
- [2026-11-07 Fixtures mode answers through the same contracts schemas as HTTP](2026-11-07-fixtures-pass-through-contracts.md)
- [2026-11-07 Payment.mandateId and scopeRef on rule intents](2026-11-07-payment-mandate-id-and-rule-scope-ref.md)
- [2026-11-07 Mock fixtures: TypeScript is the source, JSON is a tested mirror](2026-11-07-mock-fixtures-two-copies-one-test.md)
- [2026-11-07 Agent run: one retry on schema failure, two error codes, a row per run](2026-11-07-agent-run-errors-and-retry.md)
- [2026-11-07 Live eval imports the backend by path and simulates the first payment](2026-11-07-live-eval-imports-backend-by-path.md)
- [2026-11-07 AG Studio: saved dashboard definition, theme and license entry points](2026-11-07-ag-studio-definition-loading.md)
- [2026-11-08 MCP endpoint: stateless Streamable HTTP, one server per request](2026-11-08-mcp-stateless-per-request.md) — every request authenticates the agent token and builds a fresh server and transport; no sessions.
- [2026-11-07 Web chart palette](2026-11-07-web-chart-palette.md)
- [2026-11-07 Quote line position keys](2026-11-07-quote-line-position-keys.md)
- [2026-11-07 Configuration consumer test providers](2026-11-07-config-consumer-test-providers.md)
- [2026-11-08 MCP tests pin the SDK 1.32.2 shapes for invalid input and 401](2026-11-08-mcp-sdk-validation-and-401-shapes.md) — invalid tool input is an isError result, a 401 is StreamableHTTPError code 401; the tests assert those shapes.
- [2026-11-08 One payment path in the web: the approval link, in every PayPal mode](2026-11-08-single-approve-link-payment-path.md) — the web drops the PayPal JS buttons; accept returns an approval link and PayPal returns to /pay/return.
