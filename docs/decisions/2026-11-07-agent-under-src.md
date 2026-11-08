# The agent module lives under `apps/backend/src/agent`

## Context

The spec (section 7.3) and the first plan placed the agent at `apps/backend/agent/`, next to `src/`. Phase 0 configured the backend build with `rootDir: "src"` in `tsconfig.build.json` and the typecheck with `include: ["src", "*.ts"]`. A folder outside `src` would be skipped by `pnpm typecheck` and would fail `pnpm build` with TS6059 the moment `src/index.ts` imported it.

## Decision

The agent module, its prompts and the `AgentPort` implementation live in `apps/backend/src/agent/`. The plan's Tracks A and B were updated on 2026-11-07. Prompt files (`instructions.md`, `skills/*.md`) stay Markdown and are copied into `dist/agent/` by a build step owned by Track B, because `tsc` copies no non-TypeScript files.

## Alternatives considered

- **Widen `rootDir` to the package root.** Moves `dist/index.js` to `dist/src/index.js` and breaks `MIGRATIONS_FOLDER`, which resolves `../../drizzle` from `src/db` and from `dist/db` alike.
- **Prompts as TypeScript string constants.** Avoids the copy step but makes the prompts harder to read and review as text, which judges and evals do.

## Consequences

- One `include` and one `rootDir` cover the whole backend; nothing special for the agent.
- `AGENTS.md`'s repo map entry `agent/` is read as `src/agent/`; Track E2 makes it explicit.
- The production image must run `pnpm --filter @dealingwith/backend build`, which now includes the prompt copy.
