# `formatUsd` lives in `@dealingwith/contracts`

## Context

Task A0 gave the backend a `formatUsd` helper (`US$1,234.50`). The web needs the same formatting on every page, and spec copy depends on it (`US$80.00`). Two implementations drift.

## Decision

`formatUsd(cents): string` is added to `packages/contracts/src/money.ts` next to the other money helpers, with the same output as the backend's (`US$` prefix, `en-US` grouping, always two decimals, integer cents only). Track D imports it from the contracts; the integrator points the backend's `lib/format.ts` at the contracts version when Track A merges.

## Alternatives considered

- Duplicate the helper in `apps/web`: fastest, but two sources for the same string the demo shows on screen.
- Move it later: every web component would need an import change at merge.

## Consequences

One formatter for money strings in the UI, the API explanations and the MCP responses. The backend keeps its copy until the merge, when it becomes a re-export.
