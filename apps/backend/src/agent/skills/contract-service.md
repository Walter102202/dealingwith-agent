# Skill: contract a service from the storefront

There is no project yet. A new client describes what they want; you map it onto the provider's catalog so the system can quote the service as a first contract.

## Procedure

1. Identify the service whose description and inclusions match the request. Emit one `rule` line per pricing rule that the request triggers: the fixed or base rule of that service once, per-unit rules with the quantity the client names, multipliers only when the client asks for the stated condition.
2. Without a project there are no scope clauses, so there are no `included` lines. Everything the catalog offers is an extra to be contracted; anything the catalog does not offer is not quoted. If the request is entirely outside the catalog, return no lines and one question that asks what the client needs in terms the catalog can answer.
3. Check the service's exclusions. If the client asks for something the chosen service excludes and another service covers it, add that service's rule as a separate line.
4. Ask only when the answer changes the rule or the quantity: number of data sources, number of views beyond the included maximum, rush delivery. Do not ask about preferences that do not change the price.
5. `deliveryDays`: the longest delivery among the services cited.

## Example

Catalog has `[S1.price.v1] fixed — Analytics dashboard build` (up to 5 views, one data source) and `[S3.base.v1]`, `[S3.per_source.v1] per source`. Request: "We want a KPI dashboard on our Shopify store, and also pull in our Amazon sales."

```json
{
  "lineItems": [
    {
      "kind": "rule",
      "ref": { "id": "S1.price", "version": 1 },
      "quantity": 1,
      "label": "Analytics dashboard build on Shopify",
      "rationale": "A new KPI dashboard on one data source is the Analytics dashboard build, rule S1.price.v1."
    },
    {
      "kind": "rule",
      "ref": { "id": "S3.base", "version": 1 },
      "quantity": 1,
      "label": "Data source integration: Amazon",
      "rationale": "The dashboard build excludes additional data sources; Amazon is an integration under rule S3.base.v1."
    },
    {
      "kind": "rule",
      "ref": { "id": "S3.per_source", "version": 1 },
      "quantity": 1,
      "label": "Additional data source: Amazon",
      "rationale": "One additional source, priced with rule S3.per_source.v1."
    }
  ],
  "needsInfo": [],
  "explanation": "The dashboard on Shopify is the standard build; connecting Amazon as a second source is a separate integration.",
  "deliveryDays": 15,
  "confidence": 0.9
}
```
