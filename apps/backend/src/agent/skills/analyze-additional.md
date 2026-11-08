# Skill: analyze an additional request inside a project

The client already has a project with this provider. The request asks for more work, or repeats something already bought. Decide, need by need, whether the project scope covers it.

## Procedure

1. Split the request into distinct needs. "A per-branch view and a Monday summary email" is two needs.
2. For each need, scan the scope clauses in order: contract clauses first, then paid additionals. The first clause whose text covers the need decides:
   - `included` clause → an `included` line citing that clause. Adding recipients, small wording changes or re-asking for something bought is still covered.
   - `excluded` clause → an extra. Find the pricing rule whose label matches the need and emit a `rule` line; the rationale names both the excluding clause and the rule.
   - no clause → an extra if a rule clearly applies; otherwise a question.
3. Quantities: count the units the client names (two sources → `quantity: 2` on the per-unit rule, plus the base rule once). Multipliers such as rush apply only when the client asks for the condition the rule states; "no rush" means no multiplier.
4. A vague need ("make it faster", "improve the dashboard") whose fix could fall under different services is a question, not a guess. Say in `whyItChangesPrice` which services the possible answers lead to.
5. `deliveryDays`: the longest delivery among the services whose rules you cited; 0 when every line is included.

## Example of an extra on an excluded clause

Scope has `[C2] excluded — Automations, scheduled emails and alerts`; catalog has `[S2.alert.v1] fixed — Threshold alert email`. Request: "Alert me by email when any branch's daily sales drop more than 20%."

```json
{
  "lineItems": [
    {
      "kind": "rule",
      "ref": { "id": "S2.alert", "version": 1 },
      "quantity": 1,
      "label": "Daily sales drop alert (20%)",
      "rationale": "Alerts are excluded by clause C2 and priced with rule S2.alert.v1."
    }
  ],
  "needsInfo": [],
  "explanation": "A threshold alert email on an existing dashboard is an automation, which your contract excludes, so it is quoted as an extra.",
  "deliveryDays": 1,
  "confidence": 0.9
}
```

## Example of a question

Request: "Make the dashboard load faster." Nothing in the scope or the catalog names performance, and the fix depends on the cause.

```json
{
  "lineItems": [],
  "needsInfo": [
    {
      "question": "Is the slowness caused by data volume or by the dashboard design?",
      "whyItChangesPrice": "More data means a data source integration; a redesign means a new dashboard build."
    }
  ],
  "explanation": "Before quoting I need to know what is making the dashboard slow, because the two likely causes map to different services.",
  "deliveryDays": 0,
  "confidence": 0.4
}
```
