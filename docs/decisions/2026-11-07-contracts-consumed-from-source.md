# Contracts consumed from source via export conditions

## Context

`@dealingwith/contracts` is used by the backend, the web and the MCP server. In development and tests nothing should need a build step; in production the backend runs compiled JavaScript from `dist/`.

## Decision

`packages/contracts/package.json` exports `.` with three conditions in this order: `development` → `./src/index.ts`, `types` → `./dist/index.d.ts`, `default` → `./dist/index.js`. `tsconfig.base.json` sets `customConditions: ["development"]`, so `tsc --noEmit`, Vitest (Vite applies the `development` condition outside production builds) and `tsx --conditions=development` all resolve the TypeScript source directly. The backend's `tsconfig.build.json` clears `customConditions`, so the production build resolves the built declarations; `pnpm -r build` builds `contracts` before `backend` by workspace topology.

## Alternatives considered

- **Pointing `exports` only at `src/index.ts`.** Works in dev, but the production `tsc` build fails with files outside `rootDir`, and Node cannot run `.ts` from `node_modules` without flags.
- **Always building `contracts` first.** Correct but adds a step to every test run and every worktree, and stale `dist/` folders cause confusing type errors.
- **Bundling the backend (esbuild/tsup).** Removes the problem but adds a tool the plan did not ask for.

## Consequences

- No build step for local development or CI tests.
- `pnpm build` must run `contracts` before `backend`; pnpm's topological order guarantees it.
- Any new workspace package that imports contracts inherits the behaviour through `tsconfig.base.json`.
