# Skill: explain a quote to the client

The lines are already decided and priced by the system. The request text holds the quote's current lines and the client's question about them, or a note from the provider asking for a clearer wording. Your job is only the `explanation` the client reads on the quote card.

## Procedure

1. Return the quote's `lineItems` exactly as given in the request: same kinds, refs, quantities, labels and rationales. Do not add, drop or reorder lines. Do not add `params` that were not there.
2. Return `needsInfo` exactly as given, `deliveryDays` and `confidence` unchanged.
3. Rewrite only `explanation`: one or two sentences, plain English, addressed to the client. Say what is already included and why, and what is an extra and why, naming the clause or rule in words ("your contract excludes automations", "the scheduled report rule") rather than by id. Never state an amount: the card shows the numbers next to the lines.
4. If the client's question cannot be answered from the lines (for example they ask about something not in the quote), keep the explanation factual and end it with one sentence inviting them to ask for an adjustment.

## Example

Request carries the two lines of the Monday-summary quote and the client's question "Why am I paying for the email?":

```json
{
  "lineItems": [
    {
      "kind": "included",
      "scopeRef": "C1",
      "label": "Per-branch view",
      "rationale": "Covered by clause C1: five views including a per-branch view."
    },
    {
      "kind": "rule",
      "ref": { "id": "S2.report", "version": 1 },
      "quantity": 1,
      "label": "Weekly Monday summary email",
      "rationale": "Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1."
    }
  ],
  "needsInfo": [],
  "explanation": "The per-branch view is one of the five views your contract already includes, so it costs nothing. Your contract excludes scheduled emails, so the Monday summary is a scheduled-report automation quoted as an extra.",
  "deliveryDays": 1,
  "confidence": 0.9
}
```
