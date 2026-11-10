# Dashboard: three custom AG Studio widgets, money in cents, the mandate as a source

## Context

The provider dashboard (`/dashboard`) is the entry for the "Best Use of AG Grid" prize. The approved mockups ask for a table of quotes and additionals with status and channel pills that filters the charts, an "Agent budget" meter that replaces the header text "Demo mandate budget left", and money KPI tiles on a Collections page. Studio 3.1.0 has a stock `table` and a stock `value` widget, but both format numbers themselves: a cents column would read 19000 instead of US$190.00, and the repository rule is integer cents end to end with `formatUsd` only at render. The mandate is not in the dashboard sources at all.

## Decision

Three widgets registered through `createWidgets` (`apps/web/src/dashboard/widgets/`), each with a data mapping that works in the editor:

- **Quotes and additionals** (`quotes-table`): an AG Grid 36.3.0 (`ag-grid-react`, same version Studio already installs, themed with `studioGridTheme`, only the modules it uses) fed by `widgetApi.getData`. Status and channel render as the product's pills, amounts through `formatUsd`, a pinned total row sums the rows in view. A click on a pill cross-filters on that field; a click elsewhere on the row filters on the quote; Ctrl or Cmd adds to the selection; Enter and Space do the same from the keyboard. Narrow grids drop columns in a fixed order (rule, channel, client, status) and pin the amount.
- **Agent budget** (`agent-budget`): remaining, spent, total, per-purchase limit, status and expiry of the mandate, from a new `mandates` Studio source (one row, none before the mandate exists).
- **KPI tile** (`kpi-tile`): one money or count value with a data-driven count line ("2 quotes waiting for the client").

Cents fields carry `context: { unit: 'cents' }` in `sources.ts`; the widgets read it and format with `formatUsd`. Coded values keep their contract values (`mcp`, `needs_info`, `pay_now`), so filters match them, and every widget shows the product's words ("agent", "Needs info", "Pay now") through each field's `createValueFormatter`. Payments gain the channel of the request behind their quote, joined in the web from the dashboard's own quote rows.

## Alternatives considered

- Stock `table` and `value` widgets over the `…Usd` columns: no pills, no total row, and dollars as floats on screen; the charts keep using `…Usd`, since they only draw.
- The mandate through Studio's `context` prop: read once at creation, so the meter would not follow a refetch after a payment. A source updates with the data like every other widget.
- A backend field for the payment channel: the dashboard payload already has it on the quote, so the join stays in the web and the API does not change.

## Consequences

The three pages are built from stock charts plus these widgets, and all of them stay editable in the editor (they appear under "DealingWith" in Compose). `ag-grid-community` and `ag-grid-react` are now declared by `apps/web` at 36.3.0; upgrading Studio means moving them together. The widgets define no `formatShape`, so Studio's AI assistant cannot restyle them yet; that is the first thing to add if the assistant needs to. The Overview pipeline now counts quotes from the `lines` source so that its bars and the table cross-filter each other, which leaves out quotes still at "needs info" with no priced lines.

The `formatShape` consequence is superseded by [2026-11-10 custom widgets get format shapes](2026-11-10-custom-widget-format-shapes.md).
