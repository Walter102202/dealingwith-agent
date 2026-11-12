# Payments record the agent whose accept created them

## Context

Until 2026-11-12 the system enforced that an agent can only pay for its own client (the token resolves to a client, the quote must belong to that client, the agent needs `quote:accept`, the mandate must belong to the same client), but it did not record which agent paid. A payment kept the mandate it was charged against (`raw.mandateId`) and the request kept the agent that asked (`requests.agent_id`). A client can connect several agents to one mandate, and the agent that accepts need not be the one that asked, so "which agent spent this money" had no answer in the data. Walter asked for it on 2026-11-12.

## Decision

`payments.agent_id` is a nullable foreign key to `client_agents`, set by `acceptQuote` from the authenticated actor on every payment an agent's accept creates: the `mandate` payment the agent pays itself, and the `pay_now` payment it opens when a limit sends the purchase to a person (including the fallback after a declined mandate capture). A web accept leaves it null. `Payment.agentId` is optional in the contract, so the web and the MCP `get_payment` result carry it.

## Alternatives considered

- **Store it in `payments.raw`**, next to `mandateId`. No migration, but no referential integrity and no index or join for the dashboard. The agent is an identity, not PayPal detail.
- **Derive it from `requests.agent_id`.** Wrong whenever one agent asks and another accepts, or a person asks on the web and an agent pays.
- **Set it only on `mandate` payments.** A `pay_now` opened by an agent would then look the same as one opened by a person; the mode already says who approved the money, the column says who started it.

## Consequences

Every autonomous capture names both its mandate and its agent. Payments are idempotent per quote version, so when two agents of the same client accept the same version concurrently, the payment keeps the first one. Rows written before migration `0001_payment_agent` have no agent. A revoked agent stays in `client_agents`, so the reference survives revocation; a demo reset deletes payments before anything else and keeps agents. Tests that accept as an agent now create a real one with `issueAgentToken`. No screen shows the column yet.
