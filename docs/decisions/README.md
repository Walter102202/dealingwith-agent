# Decisions

One file per decision, named `YYYY-MM-DD-<slug>.md`, with these headings in this order:

- **Context** — the question and why it had to be answered now.
- **Decision** — what was decided, in one or two sentences.
- **Alternatives considered** — what else was on the table and why it lost.
- **Consequences** — what this makes easier, what it makes harder, what to revisit.

Rules: one decision per file; never edit a past decision, write a new one that supersedes it and link both; read this folder before re-opening anything that looks decided. Decisions are made by whoever is doing the work when the answer only needs judgment (see the decision rule in `AGENTS.md`); Walter decides when it needs his credentials, his money, or changes what the product is.

## Index

- [2026-11-07 TypeScript 5.9, not 7](2026-11-07-typescript-5-9.md)
- [2026-11-07 PGlite for tests and local default, pg for Render](2026-11-07-pglite-for-tests-and-local.md)
- [2026-11-07 Money as integer cents](2026-11-07-integer-cents.md)
- [2026-11-07 Contracts consumed from source via export conditions](2026-11-07-contracts-consumed-from-source.md)
- [2026-11-07 Seed creates, reset restores](2026-11-07-seed-creates-reset-restores.md)
- [2026-11-07 Reset keeps connected client agents](2026-11-07-reset-keeps-client-agents.md)
- [2026-11-07 API shapes live in contracts](2026-11-07-api-shapes-live-in-contracts.md)
- [2026-11-07 The agent module lives under src/agent](2026-11-07-agent-under-src.md)
- [2026-11-07 Mock fixtures: TypeScript is the source, JSON is a tested mirror](2026-11-07-mock-fixtures-two-copies-one-test.md)
- [2026-11-07 Agent run: one retry on schema failure, two error codes, a row per run](2026-11-07-agent-run-errors-and-retry.md)
- [2026-11-07 Live eval imports the backend by path and simulates the first payment](2026-11-07-live-eval-imports-backend-by-path.md)
