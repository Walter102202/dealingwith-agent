# Money as integer cents

## Context

Prices, totals, mandate limits and PayPal amounts flow between the pricing engine, the database, the API, the web, the MCP server and PayPal. Floating-point money produces off-by-one-cent bugs and makes idempotency comparisons unreliable.

## Decision

Every amount is an integer number of US cents (`amountCents: number`), in TypeScript and in the database (`integer` columns). Currency is always `USD`. Conversion to PayPal's decimal strings (`"80.00"`) and back happens only inside `integrations/paypal`, through `formatPaypalAmount` and `parsePaypalAmount` from `@dealingwith/contracts`. Percentages (the rush multiplier) are applied with `applyPercent`, which rounds half up to the cent.

## Alternatives considered

- **Floating-point dollars.** Simplest to read, wrong at the edges (`0.1 + 0.2`).
- **Decimal strings or a decimal library everywhere.** Correct, but heavier for every comparison and every schema; PayPal is the only consumer of the decimal form.
- **`numeric` columns.** Correct in the database but returned as strings by `pg`, pushing conversions into every query.

## Consequences

- Field names end in `Cents` so a bare number is never ambiguous.
- Multi-currency is out of scope; adding it means a currency field next to every amount, which the schema already carries on quotes, payments and mandates.
