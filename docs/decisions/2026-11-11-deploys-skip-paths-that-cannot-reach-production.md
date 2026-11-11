# Deploys skip commits that only touch paths that cannot reach production

## Context

On 2026-11-11, the day before the hackathon submission, every merge to `main` deployed on Render, including pull requests that changed only the README or `docs/`. A docs-only deploy rebuilds the same app, restarts the service in front of judges and spends build minutes for nothing. Walter asked that documentation-only changes stop deploying. The risk to avoid is the opposite one: a filter that silently skips a deploy the app needed, for example because the agent prompts are Markdown files (`apps/backend/src/agent/**/*.md`) that the backend build copies into `dist/agent`.

## Decision

The Render service declares `buildFilter.ignoredPaths` in `render.yaml`: documentation, `tests/`, `evals/`, colocated `*.test.ts(x)`, CI configuration and repository tooling files. A commit on `main` that touches only those paths does not deploy; any other path deploys as before, still gated by `autoDeployTrigger: checksPass`. The `build` job in CI proves the list on every run: it hashes every file in `apps/*/dist` and `packages/*/dist`, deletes every tracked file the patterns match (read from `render.yaml` with `yq` and expanded with `git ls-files ':(glob)…'`, the same glob rules Render documents), rebuilds, requires an identical hash list, and then boots the server in that pruned tree. Constitution Article VIII moves to version 1.1.0 to say so.

## Alternatives considered

- **An allowlist (`buildFilter.paths`)** of what reaches production. Its failure mode is the dangerous one: a forgotten input (a new root config, a new package) silently stops deploying. With a denylist, a forgotten entry only costs one unnecessary deploy.
- **Content-addressed deploys:** turn auto-deploy off, build in GitHub Actions, and call a Render deploy hook only when the artifact hash differs from the live one. It needs a stored hash of the live build, a deploy-hook secret in GitHub and a second delivery path, and it changes Article VIII far more than the problem needs. The CI proof gives the same guarantee for the listed paths with one file of configuration.
- **Skip CI for docs-only changes too** (`paths-ignore` in the workflow). The three jobs are required checks on `main`; a skipped workflow never reports, so the pull request would wait forever. Docs-only pull requests keep running the full CI (about two and a half minutes).
- **A static check of the list** (no Markdown under `apps/`, no root config). It encodes today's build in a second list that drifts; rebuilding and comparing tests the real build.

## Consequences

A docs-only merge leaves the live deploy on the previous commit, which builds the same app; Render's dashboard then shows a live commit older than `main`, and that is expected. Manual deploys (Render → Manual Deploy) ignore the filter, so a forced redeploy still works. The build job runs the production build twice: about 20 s more, well inside its four-minute limit. Adding a path to the list is a pull request like any other, and a path the build reads turns the `build` job red with the list of `dist` files it changes. Two things the proof does not cover: a file read at runtime only on some request path (the boot check covers startup only), and Render changing its glob rules; the decision should be revisited if the backend starts reading files outside `dist/` and `apps/backend/drizzle/` at runtime.
