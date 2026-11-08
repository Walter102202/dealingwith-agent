# CI/CD

How a change gets from a branch to production, and what stops it on the way. Policy lives in [`CONSTITUTION.md`](../CONSTITUTION.md) Articles IV, V and VIII; this page is the runbook.

## The pipeline in one picture

```text
branch push ──► CI (3 jobs, parallel, < 4 min each) ──► pull request ──► review ──► merge to main
                                                                                       │
                                                               CI on main (same 3 jobs) ┘
                                                                                       │
                                                        Render deploys main only if CI passed
```

## What CI runs

`.github/workflows/ci.yml`, on every push to any branch and on every pull request to `main`. A new push to the same branch cancels the run still going for the previous commit.

| Job | Steps | Catches | Duration |
|---|---|---|---|
| `checks (lint, typecheck, test)` | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` | Lockfile drift, formatting, type errors, failing tests (351 tests in 73 files) | 2 min 15 s, measured on `main` on 2026-11-08 |
| `build (production build, migrations, boot)` | `db:generate` must produce no diff; `pnpm build`; start `dist/index.js` with in-memory PGlite; `/healthz` answers `{"ok":true}` and `/login` serves the web build | Schema edited without its migration (Render would boot against a stale database); a build that passes typecheck but fails to compile or copy its prompts; a server that builds but does not start or does not serve the web | 25 s, measured on `main` on 2026-11-08 |
| `hygiene (secrets, tracked files)` | `git ls-files` contains no `docs/hackathon/`, `.env`, `.env.*` (except `.env.example`), keys or certificates; `.gitignore` still lists `docs/hackathon/`, `.env`, `.data/`; the gitleaks CLI (pinned version, checksum-verified) over every commit of every branch | A secret or the private hackathon analysis reaching GitHub | 6 s, measured on `main` on 2026-11-08 (97 commits) |

The drift check runs `drizzle-kit generate`, which asks interactively when a rename is ambiguous; in CI that would hang until the timeout. Generate renames locally and commit the SQL; CI only confirms there is nothing left to generate.

A pull request commit runs twice (once for the branch push, once for the pull request merge ref). That is deliberate: the second run tests the merge result. A new push to a branch cancels the branch's previous run; runs on `main` are never cancelled, so every `main` commit keeps its verdict for the deploy gate.

Each job has `timeout-minutes: 4`. If a job gets slower than that, the job fails and the fix is to make it faster (split test workers, cache more, remove work), never to raise the limit.

Run the same gates locally before pushing:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @dealingwith/backend db:generate && git status --porcelain apps/backend/drizzle   # must print nothing
```

## What protects `main`

A GitHub repository ruleset on the default branch, declared in [`infra/github/main-ruleset.json`](../infra/github/main-ruleset.json) so it can be reviewed and re-applied:

- Changes reach `main` only through a pull request.
- The three CI jobs are required status checks, and the branch must be up to date with `main` when they run (`strict`), so a green check always describes the exact merge result.
- Review threads must be resolved before merging.
- Force pushes and branch deletion are blocked. No bypass actors: the rules apply to administrators too.
- Required approvals: 0. The constitution requires an independent review (a second human or a fresh reviewer agent) recorded in the pull request; GitHub does not count it because a two-person team would otherwise block every solo day. Raise `required_approving_review_count` to 1 when the team grows.

Apply or re-apply it (repository admin, `gh` authenticated as `Walter102202`):

```bash
gh api -X POST repos/Walter102202/dealingwith-agent/rulesets --input infra/github/main-ruleset.json
```

To update an existing ruleset, find its id with `gh api repos/Walter102202/dealingwith-agent/rulesets` and `PUT` the same file to `rulesets/<id>`.

## Pull requests

One task per pull request, filled-in template (`.github/pull_request_template.md`), branch up to date with `main`, review recorded in the thread. A human merges, or an agent told to for that pull request; an agent never opens or merges one on its own (Constitution, Article V).

Merge method: merge commit or squash. Rebase-merging is disabled because it rewrites the commits that were reviewed.

## When CI is red

1. Read the failing step's log before anything else. Do not re-run hoping for green.
2. Reproduce locally with the command in the table above.
3. Fix with a new commit on the same branch; CI runs again on its own.
4. If a test is flaky (passes locally, fails in CI without a code change), fix the cause the same day or quarantine it with `it.skip` plus an issue that names the owner. A quarantined test is a debt with a name, not a solved problem.
5. If `hygiene` fails on gitleaks for a value that is not a secret (a fixture, a documented pattern), add an entry to `.gitleaks.toml` at the repository root (it already extends the default rules), with a comment that says what the value is; prefer a line regex over a path so a real secret in the same file is still caught. If it is a secret, rotate it in the provider immediately; the leaked value becomes worthless and history is not rewritten (Constitution, Article IV.6). Then remove it from the working tree with a normal commit.

## Delivery

Render builds and deploys `main` from the Blueprint `render.yaml` at the repository root; `infra/README.md` lists the variables and the first-deploy steps. Until the Blueprint is applied in a Render account there is no hosted deploy and nothing to roll back. The service sets `autoDeployTrigger: checksPass`: a commit on `main` deploys only when its CI run is green. Nothing deploys from a branch or from a laptop.

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`. Start: `pnpm --filter @dealingwith/backend start`. Health check: `/healthz`.
- Migrations run at boot, so a migration must be additive and compatible with the version still running while the new one starts.
- Configuration: variable names and which are secrets are listed in `infra/README.md`; values live only in Render.
- Rollback: Render dashboard → the service → Deploys → "Rollback" to the previous live deploy. Then fix forward through a normal pull request. Rolling back the code does not roll back a migration; that is why migrations are additive.

## What never runs in CI

The live model eval (`pnpm eval:live`), the PayPal sandbox smoke (`pnpm --filter @dealingwith/backend paypal:smoke`) and the hosted MCP check (`mcp:smoke`) need credentials and real services. They are run by hand, documented in `docs/paypal-notes.md` and `docs/mcp.md`, and reported without secrets.
