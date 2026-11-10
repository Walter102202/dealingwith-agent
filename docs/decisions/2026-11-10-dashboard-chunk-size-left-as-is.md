# Dashboard chunk: measured, and left as it is

## Context

`pnpm build` warns that the lazy-loaded `DashboardPage` chunk is over 500 kB. The question on 2026-11-10 was how much of it the dashboard widgets and assistant work (`feat/studio-dashboard`) added, and whether any cheap, safe change makes it meaningfully smaller.

Measured with Vite 8.3.6 (`vite build`, the sizes it reports), on `origin/main` at `e621ce8` and on `feat/studio-dashboard` at `1326617`:

| Build | DashboardPage chunk, raw | gzip |
| --- | --- | --- |
| `main` | 6,411.92 kB | 1,813.75 kB |
| `feat/studio-dashboard` | 6,653.15 kB | 1,881.85 kB |
| Added by the branch | +241.2 kB (+3.8%) | +68.1 kB (+3.8%) |

A per-package breakdown of the chunk (rendered module sizes before minification, from a measurement-only Vite plugin) shows the chunk is AG Studio and the libraries it ships with: `ag-studio` 4,829 kB, `ag-charts-enterprise` 1,918 kB, `ag-charts-community` 1,749 kB, `ag-grid-community` 1,246 kB, `ag-charts-core` 875 kB, `ag-grid-enterprise` 643 kB, `ag-stack` 211 kB, `ag-grid-react` 142 kB. The branch's growth is Studio's own AI code (+255 kB in `ag-studio`, pulled in by `AgStudioAiModule`), the AG Grid modules the quotes table registers (+24 kB) and our widgets, report and assistant code (about 60 kB). AG Grid is bundled once: every `ag-grid-*` module resolves to a single store folder at 36.3.0, shared by Studio and the quotes table.

## Decision

No code change. The one candidate in scope, loading the assistant only when the server has it on, was built and measured: a dynamic import moves 12.6 kB (0.19% of the chunk) into its own file, because `AgStudioAiModule` lives in the same `ag-studio` module file as the rest of Studio and a chunk cannot hold part of a module. Since the hosted demo runs with the assistant on, that would add a request for no visible gain.

## Alternatives considered

- **Lazy-load the assistant code.** Measured above: 12.6 kB.
- **Split AG Studio, AG Charts and AG Grid into vendor chunks** with Rolldown's code-splitting groups. It silences the warning and helps caching across deploys, but it ships the same bytes and adds hand-tuned bundler configuration to maintain.
- **Replace or trim the libraries.** Out of scope: they are the product's dashboard.
- **Raise `chunkSizeWarningLimit`.** Hides the number without changing it.

## Consequences

The build keeps warning about the dashboard chunk, and the warning is expected. The chunk loads only on `/dashboard`, after the app shell (430 kB raw, 131 kB gzip). If a later AG Studio release ships its AI module as a separate entry point, lazy-loading it becomes worth measuring again.
