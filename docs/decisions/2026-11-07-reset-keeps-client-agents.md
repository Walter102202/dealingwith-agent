# Reset keeps connected client agents

Supersedes the client-agents clause of [2026-11-07-seed-creates-reset-restores.md](2026-11-07-seed-creates-reset-restores.md); the rest of that decision stands.

## Context

The plan's Task T4 listed `client_agents` among the tables `resetDemoData` deletes, and the first implementation followed it. The spec (section 6) says the reset restores quotes, payments, clauses and `spent` and keeps the mandate funding; it says nothing about revoking agents. A judge who connects their assistant from the portal and then presses "Reset demo data" would lose the token mid-demo, and the demo script itself runs requests 2 and 3 through the connected agent right after a reset.

## Decision

`resetDemoData` never touches `client_agents`. Tokens are issued and revoked only from the portal (Task A6). Nothing seeds a token: "Mara's assistant" in the spec is a token issued in the portal, not a shared secret in the repository.

## Alternatives considered

- **Keep deleting agents on reset.** Faithful to the plan's wording, but it breaks the demo flow and contradicts the spec's definition of the reset.
- **Seed a fixed demo token.** Would let the README print a ready-made MCP URL, but a token in a public repo is a shared secret, and the portal's connect flow is part of what the demo shows.

## Consequences

- A reset between judge runs leaves every connected agent working; only requests, quotes, payments, runs and webhook events are cleared.
- `requests.agent_id` rows are deleted before agents would matter, so no foreign-key order changes.
- The provider dashboard's agent list is the only place to revoke a token.
