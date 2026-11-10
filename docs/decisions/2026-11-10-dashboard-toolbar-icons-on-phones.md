# Dashboard toolbar: Assistant and Edit as icon buttons on phones

## Context

At 600 px and below the dashboard toolbar dissolves into the page header's grid (`2026-11-10-dashboard-read-mode-by-default`), and its CSS placed every button with the `edit` class in column 2, row 1. The Assistant toggle (`2026-11-10-assistant-toggle-in-dashboard-header`) reused that class, so on phones it sat in the same cell as Edit, under it: measured on 2026-11-10 at 380 px, both were 127 x 40 px at the same position and a press on Assistant hit Edit. A provider on a phone could not open or close the assistant.

With their labels, Assistant (127 px) and Edit (89 px) beside the title would leave the title 113 px at 380 px, so "Andes Data Studio" wraps to two lines and the subtitle to five, and about 50 px at 320 px.

## Decision

Assistant and Edit sit in one group. At 600 px and below the group takes the title's row and both become 40 x 40 px icon buttons, the sparkle and the pencil they already carry; each label stays in the button as visually hidden text, so the accessible names ("Assistant", "Edit") and the pressed state do not change. Above 600 px they look as before.

## Alternatives considered

- **The two buttons on a row of their own.** Keeps the labels, but adds a third row of about 48 px to the phone header, above a report that already has little height.
- **Labelled buttons beside the title.** Squeezes the title as measured above.
- **Assistant in the page-tabs row.** The tabs already need 323 of the 348 px a 380 px header leaves.

The header decision (`2026-11-10-header-menu-on-phones`) rejected icon-only buttons because they left Storefront and the name unreachable and made every action a guess from its icon. Here nothing becomes unreachable, there are two toggles, their icons are the usual marks for an assistant and for editing, and the pressed one is filled.

## Consequences

At 380 and 320 px both toggles are separate 40 px targets beside the title and the phone header keeps its two rows (145 px at 380 px). Between 601 and about 650 px the pair wraps under the tabs together, where before only Edit wrapped. A third toolbar action on phones would need this row measured again.
