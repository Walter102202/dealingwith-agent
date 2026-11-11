# Decisions

One file per decision, named `YYYY-MM-DD-<slug>.md`, with these headings in this order:

- **Context** — the question and why it had to be answered now.
- **Decision** — what was decided, in one or two sentences.
- **Alternatives considered** — what else was on the table and why it lost.
- **Consequences** — what this makes easier, what it makes harder, what to revisit.

Rules: one decision per file; never edit a past decision, write a new one that supersedes it and link both; read this folder before re-opening anything that looks decided. Decisions are made by whoever is doing the work when the answer only needs judgment (see the decision rule in `AGENTS.md`); Walter decides when it needs his credentials, his money, or changes what the product is.

## Index

- [2026-11-08 Mandate capture invoice identity](2026-11-08-mandate-capture-invoice-identity.md)

- [2026-11-08 Approved webhook capture boundary](2026-11-08-approved-webhook-capture-boundary.md)

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
- [2026-11-08 Demo script targets the hosted sandbox, with Claude Code as the agent](2026-11-08-demo-script-targets-hosted-sandbox.md) — the video is recorded on the hosted URL; one recording pause to add the MCP server.
- [2026-11-08 One payment path in the web: the approval link, in every PayPal mode](2026-11-08-single-approve-link-payment-path.md) — the web drops the PayPal JS buttons; accept returns an approval link and PayPal returns to /pay/return.
- [2026-11-08-list-projects-tool](2026-11-08-list-projects-tool.md) — a ninth MCP tool so agents can discover project ids
- [2026-11-08 Hosted on Render first, dealingwith.si later, demo mode until the submission](2026-11-08-hosted-at-dealingwith-si-demo-mode-until-submission.md) — APP_URL dashboard-owned; the domain attached later with the webhook re-registered; demo logins and sandbox until real authentication ships after the submission; capped model keys.
- [2026-11-08 Quote card accept label](2026-11-08-quote-card-accept-label.md) — the label reads "Accept quote v<n>", the button names the action; the spec string "Accept and pay with PayPal" is retired.
- [2026-11-08 APP_URL from RENDER_EXTERNAL_URL](2026-11-08-app-url-from-render-external-url.md) — explicit value, then Render's own https URL, then localhost; https mandatory on Render; empty means unset.
- [2026-11-08 Constitution and CI gates](2026-11-08-constitution-and-ci-gates.md) — `CONSTITUTION.md` above every other document; three parallel CI jobs under four minutes; `main` protected by a ruleset; Render deploys only after CI passes.
- [2026-11-09 Landing page at `/`, storefront at `/store`](2026-11-09-landing-at-root-storefront-at-store.md) — the product explains itself on the first screen with the real quote card in a read-only preview; storefront links and redirects move to `/store`.
- [2026-11-09 Geist type, pill controls and floating header; colours unchanged](2026-11-09-geist-type-and-pill-shapes.md) — Geist and Geist Mono self-hosted; pills, softer cards and a floating header across the app; an editorial landing with a replayed project page and agent terminal; palette untouched.
- [2026-11-10 Dashboard assistant: Claude through the backend with the official SDK](2026-11-10-assistant-anthropic-adapter-on-backend.md) — AG Studio's chat posts each turn to `/api/dashboard/assistant/turn`; the backend calls Claude Sonnet 5.5 with `@anthropic-ai/sdk` and streams AG events back; the wire format lives in contracts.
- [2026-11-10 Dashboard assistant: thinking blocks are never replayed](2026-11-10-assistant-no-thinking-replay.md) — AG items carry no signatures and Studio rebuilds instructions and tools every turn, so each turn is rebuilt from text and tool calls only.
- [2026-11-10 Dashboard assistant: a daily cap on turns](2026-11-10-assistant-daily-turn-cap.md) — `ASSISTANT_DAILY_TURN_LIMIT` turns per UTC day, default 400, then 429 `assistant_daily_limit`; one log line per turn.
- [2026-11-10 Collections agent: the model writes the words, code writes the amounts](2026-11-10-collections-agent-amounts-from-data.md) — reminder amounts, quote references and totals are rendered from the dashboard rows in integer cents; wording with amounts is refused; the draft is shown, never sent.
- [2026-11-10 Dashboard: three custom AG Studio widgets, money in cents, the mandate as a source](2026-11-10-studio-custom-widgets.md) — an AG Grid quotes table with pills and cross-filtering, an agent budget meter from a new `mandates` source, a KPI tile; cents fields marked by `context` and formatted with `formatUsd`.
- [2026-11-10 Dashboard opens as a report: read mode, page tabs and an Edit toggle](2026-11-10-dashboard-read-mode-by-default.md) — three pages selected from the header, no panels in read mode, two columns then one below 1000 px.
- [2026-11-10 The assistant opens beside the report from an Assistant toggle](2026-11-10-assistant-toggle-in-dashboard-header.md) — Studio offers its AI panel in edit mode only, so the header has report, assistant and edit states; Assistant is edit mode with only the chat panel.
- [2026-11-10 Reminder drafts show above the report as soon as they are ready](2026-11-10-reminder-draft-above-the-report.md) — Studio 3.1.0 keeps tool steps collapsed with no way to open them, so the draft tool hands its code-rendered draft to the page, which shows it in a dismissible card above the report; the chat step keeps it in the history.
- [2026-11-10 Header: the session actions fold into a Menu pill on phones](2026-11-10-header-menu-on-phones.md) — at 600 px and below a Menu pill opens a panel with every session action for the role, so nothing is cut off or scrolls sideways at 380 or 320 px; wider screens keep the pill unchanged.
- [2026-11-10 Dashboard chunk: measured, and left as it is](2026-11-10-dashboard-chunk-size-left-as-is.md) — the widgets and assistant add 241 kB raw (68 kB gzip, +3.8%) to a 6.4 MB chunk that is AG Studio, Charts and Grid; AG Grid is bundled once; lazy-loading the assistant saves 12.6 kB, so nothing changes.
- [2026-11-10 Custom widgets get format shapes, so the assistant can restyle them](2026-11-10-custom-widget-format-shapes.md) — each custom widget declares Studio's titles and cross filter plus a few style options it honours (table density and total row, which budget details show, KPI value size and count line); the shape builder is borrowed from `defineAiCommand`; supersedes the formatShape consequence of the custom widgets decision.
- [2026-11-10 An assistant restyle keeps the format keys it leaves out](2026-11-10-restyle-keeps-format-keys.md) — the Widget agent's `configure_widget` is wrapped so every top-level format key a call leaves out keeps its current value, for every widget type; a key sent wins, so a title is hidden with `enabled: false`; one write, one undo step; supersedes the guidance-only rule of the format shapes decision.
- [2026-11-10 Cercana favicon](2026-11-10-cercana-favicon.md) — the approved two-piece D with curved joins replaces the serif placeholder; a standalone SVG, multi-size ICO and Apple touch icon share the same artwork.
- [2026-11-10 Header: the Menu pill from 840 px down, for every role](2026-11-10-header-menu-from-840px.md) — the provider's actions need 635 px of pill, which only a viewport of about 822 px leaves, so the menu starts at 840 px for every role and nothing is hidden between 601 and 840 px; supersedes the 600 px breakpoint of the header menu decision.
- [2026-11-10 Dashboard toolbar: Assistant and Edit as icon buttons on phones](2026-11-10-dashboard-toolbar-icons-on-phones.md) — at 600 px and below Edit covered the Assistant toggle; the two now share a group beside the title as 40 px icon buttons whose labels stay as their accessible names.
- [2026-11-10 Reminder drafts read in the page's scroll, not their own](2026-11-10-reminder-draft-in-the-page-scroll.md) — the card drops its 42% cap and inner scroll at every width; with a draft open the page grows and Studio keeps a full screen below it; supersedes the card's own scroll in the reminder-draft decision.
- [2026-11-11 Deploys skip commits that only touch paths that cannot reach production](2026-11-11-deploys-skip-paths-that-cannot-reach-production.md) — `buildFilter.ignoredPaths` in `render.yaml` (docs, tests, CI and tooling files); the `build` job deletes every file they match, rebuilds and requires a byte-identical build; Constitution 1.1.0.
