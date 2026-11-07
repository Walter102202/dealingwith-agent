# DealingWith Agent — Roadmap

What the MVP deliberately leaves out, and the order in which we would add it. The MVP scope is the approved design (`docs/design/2026-11-07-dealingwith-agent-mvp-design.md`); progress against it is tracked in `docs/milestones.md`. Items here are not promises; they are the product vision beyond the first release, with the reason each one waits.

## Stretch for the first release (only if everything else is deployed)

These are in the design as P2. They are the first things we pick up if time remains.

- **Natural-language dashboard widget** with the AG Studio Agent Framework, served by our own backend so the model key stays server-side.
- **MCP Apps quote card:** the quote rendered as an interactive card inside Claude or ChatGPT, using shared components from `packages/ui`, so the client reviews and corrects a quote without leaving their assistant.
- **PayPal Vault for standing mandates:** save the client's PayPal wallet once and charge against the token, replacing the authorization-plus-partial-capture funding model. Blocked today by sandbox enablement; the MVP probes it once and records the result.

## Hardening after the hackathon

- **OAuth for the MCP server** (authorization code with PKCE) instead of per-agent bearer tokens, so clients connect without copying secrets.
- **Real authentication and onboarding:** provider signup, client invitations, email login; today sessions are demo-only.
- **Multi-tenant UI:** the data model already carries `business_id` everywhere; what is missing is the UI to create and manage more than one business.
- **Rate limiting and abuse controls** on the MCP endpoint and the request box.
- **Durable workflows:** persisted state and retries for accept → pay → update, so an interrupted process resumes instead of relying on the webhook to reconcile.
- **Observability:** today `agent_runs` and structured logs; next, request → run → quote → payment traces, cost per valid contract, and time from request to paid work.
- **Live mode** with a PayPal Chile business account, including the 29-day authorization lifetime and the re-authorization path.

## Product

- **Custom work before contracting:** a polished journey for a new request outside a project (the engine and MCP tool already support it; the MVP gives it no dedicated screens).
- **Files on requests:** briefs, screenshots and documents attached to a request and used by the agent.
- **Adjust a quote line by line:** the client corrects an assumption on one line and the agent re-prices only what changed.
- **Learning from corrections:** when the provider corrects an interpretation, store it as an eval case, propose a rule or instruction change, test it, then activate it.
- **Human-agent collaboration evals:** scenarios where the client starts with their agent and finishes on the web, measuring corrections, intervention time and cost per valid contract.
- **Provider controls for autonomy:** per-client defaults for mandates, approval thresholds and a review queue for agent-initiated purchases.
- **Multi-currency** and local tax rules; the MVP is USD only.
- **Notifications:** email or chat message to the provider when a quote is paid or needs a decision, and to the client when a quote is published.

## Payments

- **Partial refunds and disputes** surfaced in the project timeline.
- **Deposits and milestone payments** for larger scopes (authorize the total, capture per milestone).
- **PayPal Invoicing** as an alternative for clients who pay by invoice.
- **Agent-to-agent settlement:** a client's agent and a provider's agent agree on scope and price and settle under both parties' mandates.

## Platform

- **Codex and other MCP clients** in the connection snippets once their remote MCP syntax is verified.
- **`packages/ui`** populated with the quote card and mandate components shared between the web and MCP Apps.
- **Webhook replay and admin tools** for reconciling payments without touching the database.
- **Custom domain** `dealingwith.si` (configuration only; the MVP may ship on the Render URL).
