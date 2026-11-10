# Collections agent: the model writes the words, code writes the amounts

## Context

The dashboard assistant (`2026-11-10-assistant-anthropic-adapter-on-backend`) gains one custom agent next to AG Studio's built-ins: Collections, which finds unpaid additionals (priced extra lines on quotes that are published or accepted but not yet paid) and drafts a payment reminder for a client. A reminder states what the client owes. CONSTITUTION Article II.2 says the model never prices; a reminder whose figures came from model output would break that in a quieter way, because a wrong total in a friendly email is still a wrong total.

## Decision

The Collections tools live in the browser (`apps/web/src/dashboard/assistant/collections.ts`) and read the rows the dashboard already loaded.

- `list_unpaid_additionals` returns each client's lines and total as `formatUsd` strings computed from integer cents.
- `draft_payment_reminder` accepts only `clientName`, `greeting`, `message` and `signOff`. Unknown arguments (an `amountCents`, a `total`, a `lines` array) are dropped by the schema. Wording that contains a currency amount is refused with an issue telling the model to write it without amounts. The tool then renders the itemised quote references, line amounts and total from the data and returns the draft as tool data.
- The chat shows the draft through AG's `aiToolDisplay` detail component (`ReminderDetail.tsx`), which formats the cents itself; the model's reply only says the draft is ready.
- The draft is never sent. It is signed with the provider's name from the session.

A test (`collections.test.ts`, "an amount the model tries to supply cannot change the itemised amounts or the total") feeds smuggled amounts and amount-bearing wording and asserts the figures and total are unchanged or the draft is refused.

## Alternatives considered

- **Let the model write the whole reminder from the listed amounts.** Simplest, and usually right, but nothing would stop a transposed or rounded figure reaching the client.
- **Compose reminders on the backend.** Keeps the logic server-side, but needs a new endpoint and repository reads for data the dashboard already holds, and the reminder is never stored or sent.
- **Free-form wording with amounts stripped after the fact.** Rewriting the model's text silently produces sentences that no longer read well; refusing and asking again keeps the words coherent.

## Consequences

Amounts in a reminder are as correct as the dashboard data, by construction. The money pattern is deliberately broad (`$5`, `20 USD`, `165.50`), so wording such as "version 2.10" would be refused once; the model retries without it. Sending reminders, if it ever ships, needs its own decision on consent and delivery.
