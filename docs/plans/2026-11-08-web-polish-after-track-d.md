# Web polish after Track D: the deferred minors

> **For agentic workers:** work this plan task by task in the order given. Steps use checkbox (`- [ ]`) syntax. The rules of `docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md` ("How to work on this plan": preflight, decision rule, bugs rule, reporting format) apply unchanged; this file only adds the tasks.

**Goal:** close the thirteen minors Track D's final review deferred (`dealingwith-reports/track-d.md`, "Deferred minors"), without changing what the web does for the demo.

**Architecture:** `apps/web` is React 19 + Vite 8 + react-router 7, plain CSS Modules, one API client (`src/api/client.ts`) that validates every response with the contracts schemas, an in-browser fixtures API for tests (`src/api/fixtures/`), and an AG Studio dashboard (`src/dashboard/`). Every task below edits existing files; no new dependency.

**Tech stack:** as `apps/web/package.json` on `main`. Tests: Vitest 5 + jsdom + Testing Library; run them with `pnpm --filter @dealingwith/web test` (fast) and the whole repo with `pnpm test` before each commit.

**Spec:** `docs/design/2026-11-07-dealingwith-agent-mvp-design.md` section 5 (web) is the behaviour to preserve. Nothing here adds a feature.

## Preflight numbers

`main` at `11b84ab` or later (Tracks A, B and D merged); `pnpm test` there reports 64 test files and 253 tests. Branch `track/w`, worktree `../dealingwith-track-w`, report `dealingwith-reports/track-w.md`. If you run the app by hand: backend `PORT=3003 APP_URL=http://localhost:5174 pnpm --filter @dealingwith/backend dev`, web `VITE_API_MODE=http VITE_API_PROXY=http://localhost:3003 pnpm --filter @dealingwith/web dev --port 5174`. Tracks A9 (Codex) and C (Claude) run in parallel on their branches and never touch `apps/web`; do not read or depend on them.

## Read first

`apps/web/src/{app.tsx,session.tsx,api/client.ts,api/errors.ts,api/config.ts,api/hooks.ts}`, the component you are about to edit and its test (every component below has a `*.test.tsx` next to it except `ServiceCard`, `DashboardPage` and `PayReturnPage`'s receipt label, which get one), `apps/web/src/test/setup.ts`, and `docs/decisions/2026-11-07-*.md` for the web (plain CSS, fixtures pass through contracts, AG Studio). Read; never guess a name.

## Files you may touch, and nothing else

`apps/web/src/**` (the files each task names, plus the tests), `docs/milestones.md` (the three W lines), `docs/decisions/` (new files plus their line in `README.md`). Never: `packages/contracts`, `apps/backend`, root configuration, `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`.

## Decisions already taken (do not reopen)

- Money on screen is always `formatUsd` from `@dealingwith/contracts` (`US$1,200.00`, two decimals). The storefront's short form (`US$1,200`) goes away; consistency over brevity.
- The dashboard title is the provider session's `name` (`Session` for a provider is `{ role: 'provider', businessId, name }`, `packages/contracts/src/access.ts:15`). The web keeps no business name of its own for the dashboard; `src/demo-brand.ts` stays for the storefront only.
- A signed-in person who opens a page of the other role is sent to their own home (`/dashboard` for a provider, `/` for a client), never to `/login`.
- A response that fails its contracts schema shows one fixed sentence to the person and logs the Zod error to the console. The sentence: `The server answered in an unexpected format. Reload the page; if it keeps happening, the app and the API are out of step.`
- The browser's own console line for a 401 on `GET /api/me` when nobody is signed in (item 13) is not a bug the web can fix: the request is needed to restore a session and browsers log every non-2xx response themselves. No change; the plan records it.
- Item 7 (sandbox `createOrder` with an already captured order) was done by Track W while `PayPalSandboxButtons.tsx` existed; on 2026-11-08 Walter chose the single approve-link payment path and the integrator removed that file and the PayPal JS SDK (`docs/decisions/2026-11-08-single-approve-link-payment-path.md`).

## Tasks

Order: W1 (what a person sees in the demo), W2 (correctness), W3 (code health). One commit per task group, `fix(web): …` or `refactor(web): …`, pushed, and the matching W line of `docs/milestones.md` ticked in the same commit.

### Task W1: visible fixes (items 3, 6, 4, 2, 12, 10)

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx:43` (`<h1>Andes Data Studio</h1>`), `apps/web/src/components/MandatePanel.tsx:249-262`, `apps/web/src/pages/PayReturnPage.tsx:84-87`, `apps/web/src/components/ServiceCard.tsx:18-32`, `apps/web/src/dashboard/theme.ts`, `apps/web/src/dashboard/studio-config.ts:7-8`
- Test: `apps/web/src/components/MandatePanel.test.tsx`, `apps/web/src/pages/PayReturnPage.test.tsx`, new `apps/web/src/components/ServiceCard.test.tsx`, new `apps/web/src/pages/DashboardPage.test.tsx` (header only; mock `ag-studio-react` with `vi.mock` so Studio never mounts in jsdom)

- [ ] **Step 1: failing tests.**
  - `DashboardPage.test.tsx`: with `useSession` mocked to `{ session: { role: 'provider', businessId: '…', name: 'Andes Data Studio' }, status: 'ready' }` the `h1` reads `Andes Data Studio`; with `name: 'Other Studio'` it reads `Other Studio`.
  - `MandatePanel.test.tsx`: a mandate with `status: 'revoked'` and no PayPal authorization renders no button named `Authorize with PayPal` and shows the text `This mandate is revoked.`; same for `expired` (`This mandate is expired.`); `pending` still shows the button; `active` and backed with headroom below the per-purchase limit still shows `Re-authorize`.
  - `PayReturnPage.test.tsx`: a paid storefront quote (no `projectId`) shows the link `Back to the storefront` pointing at `/`; a project quote keeps `Back to project`.
  - `ServiceCard.test.tsx`: a service whose rules are `fixed 8000` + `fixed 6000` renders the summary containing `US$80.00` and `US$60.00`; a service with one fixed rule `120000` renders `US$1,200.00` once (the `Money` total) and no `US$1,200` short form.
- [ ] **Step 2: run** `pnpm --filter @dealingwith/web test` → the new assertions FAIL.
- [ ] **Step 3: implement.**
  - `DashboardPage.tsx`: `const { session } = useSession();` and `<h1>{session?.role === 'provider' ? session.name : 'Dashboard'}</h1>`.
  - `MandatePanel.tsx`: `const canFund = mandate.status === 'pending' || mandate.status === 'active';` the fund button and form render only when `canFund && (!backed || needsReauth)`; otherwise, for `expired`, `revoked` and `exhausted`, a `<p className="muted small">This mandate is {mandate.status}.</p>`.
  - `PayReturnPage.tsx`: link text `projectId ? 'Back to project' : 'Back to the storefront'`.
  - `ServiceCard.tsx`: delete `formatShort`; `ruleSummary` uses `formatUsd` from `@dealingwith/contracts`.
  - `theme.ts`: add `chartPaletteFills1Color` … `chartPaletteFills6Color` (names from `ag-studio/dist/types/api/theme/chartTheme.d.ts`, `StudioChartPaletteParams`) with six colours derived from the tokens in `src/styles.css`: the accent `#0e6b52` first, then five hues that read well on `#ffffff` and pass the dataviz rule of distinct lightness; put the six hex values in one `const PALETTE = [...]` with a comment naming the token each comes from. If the type also declares `chartPaletteStrokes1Color` …, set them to the same values.
  - `studio-config.ts:8`: the decision file is `2026-11-07-ag-studio-definition-loading` (verify with `ls docs/decisions`).
- [ ] **Step 4: run** the web tests → PASS; `pnpm lint && pnpm typecheck && pnpm test` from the worktree root → green.
- [ ] **Step 5: commit** `fix(web): dashboard title from the session, no Authorize on dead mandates, storefront receipt link, one money format, chart palette` (one commit is fine; two if you prefer palette apart), tick the W1 line, push.

### Task W2: correctness fixes (items 9, 8, 5, 7)

**Files:**
- Create: `apps/web/src/components/RequireSession.tsx` (moved out of `app.tsx:14-26`), `apps/web/src/components/RequireSession.test.tsx`, `apps/web/src/api/errors.test.ts`
- Modify: `apps/web/src/app.tsx`, `apps/web/src/api/errors.ts:17-21` (`errorMessage`), `apps/web/src/components/QuoteCard.tsx:140-142`, `apps/web/src/components/PayWithPayPal.tsx:65-71` (only if `PayPalSandboxButtons.tsx` still exists)
- Test: `apps/web/src/components/QuoteCard.test.tsx`, `apps/web/src/components/PayWithPayPal.test.tsx`

- [ ] **Step 1: failing tests.**
  - `RequireSession.test.tsx` (mock `../session.js` so `useSession` returns what each case needs; render inside `MemoryRouter` with routes for `/login`, `/dashboard`, `/` that print their path): no session → lands on `/login`; provider session with `as="client"` → lands on `/dashboard`; client session with `as="provider"` → lands on `/`; matching role → renders the children; `status: 'loading'` → renders `Loading…`.
  - `errors.test.ts`: `errorMessage(new ZodError([]))` (import `ZodError` from `zod`) returns the fixed sentence from the decisions above and `console.error` was called once with the error; `errorMessage(new ApiRequestError(403, 'forbidden', 'You cannot access this quote'))` still returns the API message.
  - `QuoteCard.test.tsx`: a quote with two `rule` lines that share the label `Additional data source` renders two list items and React logs no `Encountered two children with the same key` warning (spy on `console.error` and assert no call containing `same key`).
  - `PayWithPayPal.test.tsx` (skip if the sandbox file is gone): in sandbox config, when `POST /api/quotes/:id/accept` answers `{ status: 'paid', payment }`, `onPaid` is called with that payment and the buttons' `createOrder` rejects without surfacing an error message on screen.
- [ ] **Step 2: run** → FAIL.
- [ ] **Step 3: implement.**
  - `RequireSession.tsx`: same component as today plus the role redirect: `if (!session) return <Navigate to="/login" replace />; if (as && session.role !== as) return <Navigate to={session.role === 'provider' ? '/dashboard' : '/'} replace />;`. `app.tsx` imports it.
  - `errors.ts`: `import { ZodError } from 'zod'`; in `errorMessage`, before the generic `Error` branch: `if (error instanceof ZodError) { console.error(error); return '<the fixed sentence>'; }`.
  - `QuoteCard.tsx:141`: `key={`${index}-${line.kind}`}` using the map index (line order is fixed per quote version; the list is never reordered).
  - `PayWithPayPal.tsx`: in `createOrder`, `if (result.status === 'paid') { onPaid(result.payment); throw new AlreadyPaidError(); }` where `class AlreadyPaidError extends Error {}` is local to the file, and the `onError` passed to the buttons ignores `AlreadyPaidError` instances.
- [ ] **Step 4: run** web tests, then the root `pnpm lint && pnpm typecheck && pnpm test` → green.
- [ ] **Step 5: commit** `fix(web): role-aware redirects, readable contract-drift errors, stable quote line keys, already-paid orders in sandbox`, tick W2, push.

### Task W3: code health (items 1, 11)

**Files:**
- Create: `apps/web/src/api/config.tsx` (replaces `config.ts`; a React context), `apps/web/src/api/fixtures/handlers/{session,catalog,quotes,payments,mandates,agents,dashboard}.ts`
- Modify: `apps/web/src/app.tsx` (wrap the routes in `<AppConfigProvider>` inside `SessionProvider`), `apps/web/src/api/fixtures/handlers.ts` (becomes the assembly of the seven files, same exported `handlers` object, same method names), `apps/web/src/components/Layout.test.tsx` and `apps/web/src/components/PayWithPayPal.test.tsx` (render under the provider through a shared helper)
- Test: new `apps/web/src/api/config.test.tsx`; `apps/web/src/api/fixtures/fixtures.test.ts` unchanged and green

- [ ] **Step 1: failing tests.**
  - `config.test.tsx`: with `api.get` mocked, rendering `<AppConfigProvider>` with two components that call `useAppConfig()` performs one `GET /api/config` (mock called once) and both see the same `data`; `useAppConfig()` outside the provider throws `useAppConfig must be used inside AppConfigProvider`.
  - `fixtures.test.ts`: unchanged; it must pass after the split with no edits.
- [ ] **Step 2: run** → FAIL (the provider does not exist).
- [ ] **Step 3: implement.**
  - `config.tsx`: `AppConfigProvider({ children })` runs `useApi(fetchConfig)` once and puts the `ApiState<AppConfig>` in a context; `useAppConfig(): ApiState<AppConfig>` reads it (same return type as today, so `Layout.tsx` and `PayWithPayPal.tsx` need no change). Add `src/test/render.tsx` with `renderWithProviders(ui)` that wraps in `MemoryRouter` + `AppConfigProvider` (and the mocked session the existing tests already use) and switch `Layout.test.tsx` and `PayWithPayPal.test.tsx` to it.
  - `handlers/`: move the methods of the `handlers` object by domain, keeping shared helpers (`origin`, `notFound`, `pad`, `activeAgents`, `supersedeOlderVersions`, `quoteFromText`, `latestQuote`, `appendPaidClauses`, `randomToken`, `handlers.ts:26-107`) in `handlers/shared.ts`. `handlers.ts` ends as `export const handlers = { ...sessionHandlers, ...catalogHandlers, ... }` with the same method names, so `dispatch.ts` does not change. No file over 150 lines.
- [ ] **Step 4: run** web tests, then the root checks → green; `pnpm --filter @dealingwith/web build` → built.
- [ ] **Step 5: commit** `refactor(web): app config in a context fetched once; fixtures handlers split by domain`, tick W3, push.

## Definition of done

W1–W3 committed and pushed on `track/w`; `pnpm lint && pnpm typecheck && pnpm test` green from the worktree root (at least 69 test files); `pnpm --filter @dealingwith/web build` succeeds; GitHub Actions green on the last push; the three W lines ticked in `docs/milestones.md`; report at `dealingwith-reports/track-w.md` in the plan's reporting format, listing item 13 as "no change, documented" and item 7 as done or skipped with the reason, ending with `STATUS: DONE`.

## Known traps of this track

- `useSession` throws outside `SessionProvider`; every test that renders a page or `Layout` mocks `../session.js` or wraps in the provider. Read `Layout.test.tsx` first to copy the pattern.
- `DashboardPage` is `React.lazy` in `app.tsx`; test the page module directly (default export) with `ag-studio-react` mocked, never through `App`.
- Biome formats on `pnpm lint`; run `npx biome check --write apps/web/src` before committing if lint complains about import order.
- Vite may serve a stale module after a whole-file rewrite (Track D's friction); touch the file again.
