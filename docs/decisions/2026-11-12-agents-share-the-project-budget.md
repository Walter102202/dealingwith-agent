# The agents of one client share the project budget, and every accept names its agent

## Context

On 2026-11-12, after `payments.agent_id` shipped (decision [2026-11-12-payments-record-the-accepting-agent](2026-11-12-payments-record-the-accepting-agent.md)), three gaps remained. No screen showed which agent paid. A quote whose lines are all included creates no payment, so nothing recorded which agent accepted it. And two tools disagreed: for an agent with no mandate attached, `get_mandate` answered "no mandate, every accepted quote needs human approval", while `accept_quote` fell back to the mandate of the project and paid from it. Walter was asked whether such an agent should be able to spend the project budget and answered on 2026-11-12: for now the agents share the same budget.

## Decision

- **Shared budget, one resolver.** `mandateForAgent` (`modules/mandates/mandates.ts`) returns the mandate attached to the agent, otherwise the project's. `accept_quote` and `get_mandate` both call it, so the tool that reports the budget and the tool that spends it cannot disagree. `get_mandate` takes an optional `projectId`; without it an agent with no mandate of its own gets the client's most recent mandate that is not revoked.
- **The accepted quote names its agent.** `quotes.accepted_agent_id` (nullable foreign key to `client_agents`, migration `0002_quote_accepted_agent`) is set when an agent's accept moves the version to `accepted` or, for a zero total, straight to `paid`. The first accept wins; a web accept leaves it null. `Quote.acceptedAgentId` is optional in the contract.
- **The name is shown.** The project page shows "Paid by <agent>" on each mandate payment and "Accepted by <agent>" on the quote card, resolved in the web from the agents the page already loads. The dashboard payments source gains `agentName`, resolved in the backend because the provider does not load the client's agents.

## Alternatives considered

- **Strict: an agent pays only from a mandate attached to it.** The narrower grant, and what the old `get_mandate` text implied. It strands an agent connected before the project had a mandate, and Walter chose the shared budget. Revisit together with per-agent limits.
- **Only reword the `get_mandate` message.** The tool would still return `null` for a budget the agent can spend; an agent deciding whether to accept reads the limits from it.
- **Derive the accepting agent from the payment.** There is no payment for a zero total, which is the case this closes.
- **A new payments table in the dashboard.** The dashboard is in the hackathon video recorded on 2026-11-12; adding the field to the source makes it available to Studio and the assistant without changing a page.

## Consequences

Limits are per mandate, not per agent: two agents of one client draw on the same per-purchase and total limits, and what each spent is the sum of its payments. Quotes accepted before migration `0002` name no agent. `get_mandate` accepts `{}` as before, so existing clients keep working. No dashboard page shows `agentName` yet; it is a field the provider or the assistant can add to a widget.
