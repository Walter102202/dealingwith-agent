# Dashboard opens as a report: read mode, page tabs and an Edit toggle

## Context

`/dashboard` opened Studio in edit mode with every panel showing, so the first thing a provider (or a judge) saw was an editor, and the canvas overflowed below 600 px. The approved mockups show a clean report with Overview, Collections and Agent channel tabs and an Edit button in the page header.

## Decision

`<AgStudio mode>` is driven by the page and starts at `'view'`; the Edit button in the header switches it to `'edit'` and back (`aria-pressed`). Studio has no page names, so the header draws the tabs from `DASHBOARD_PAGES` and selects a page with `api.setState({ ...api.getState(), selectedPageId })`; `onStateUpdated` reports the page back, so undo and the editor's own page list stay in step. Panels: none in read mode; in edit mode Studio's defaults (assistant on the left; filters, compose and data on the right). Below 1000 px the canvas re-flows in read mode through `responsiveLayoutBreakpoints`: two columns that pair widgets within their desktop row (an odd one takes the full width) from 600 to 999 px, and Studio's `singleColumnLayout` below 600 px. The theme lets the canvas shrink to 300 px, and the page header stacks the title over the tabs below 900 px and puts Edit beside the title below 600 px.

## Alternatives considered

- Keep edit mode as the default: shows the product's internals before its numbers.
- Studio's own page navigation: 3.1.0 draws no page bar and its pages have no names; a host-drawn bar also matches the product's pill controls.
- A single-column layout below 1000 px: wastes a tablet's width on small KPI tiles.

## Consequences

Edit mode always shows the desktop layout (Studio applies breakpoints in read mode only), so editing on a phone is not a goal. The `panels` prop is set explicitly; a teammate adding the AI panel extends `DASHBOARD_PANELS.edit` rather than adding a second `panels` prop.
