# The assistant opens beside the report from an Assistant toggle in the header

## Context

The dashboard opens as a report with no panels (decision [2026-11-10 dashboard read mode by default](2026-11-10-dashboard-read-mode-by-default.md)), and the assistant lives in Studio's AI panel (decision [2026-11-10 assistant adapter on the backend](2026-11-10-assistant-anthropic-adapter-on-backend.md)). AG Studio 3.1.0 offers that panel in edit mode only: `AgViewModePanelType` is `'filters'`. Merged as they were, the two tracks hid the assistant behind Edit, next to three editing panels, while the approved mockup shows the report with the chat beside it.

## Decision

The header has three states: report, assistant and edit. The Assistant toggle puts Studio in edit mode with `ASSISTANT_PANELS` (only `ai`, on the right); Edit keeps `DASHBOARD_PANELS` (assistant on the left; filters, compose and data on the right). The toggle is drawn only when `/api/config` reports the assistant on.

## Alternatives considered

- Leave the assistant inside Edit: one click further and surrounded by the editor, for the feature the page most wants to show.
- A chat panel of our own in read mode: rebuilds what Studio's panel already does and leaves the Studio Agent Framework's own UI unused.

## Consequences

With the assistant open the canvas is Studio's edit canvas: widgets can be selected and moved, and the layout is the desktop one (Studio applies responsive breakpoints in read mode only). That fits, since the assistant edits the dashboard. A reminder draft sits inside the Collections step of the chat and takes two clicks to open; showing it expanded is a follow-up.
