# Reminder drafts read in the page's scroll, not their own

Supersedes the card's own scroll past 42% of the viewport in [2026-11-10 Reminder drafts show above the report as soon as they are ready](2026-11-10-reminder-draft-above-the-report.md); the card, where it sits and how it is dismissed stand.

## Context

Measured on 2026-11-10 with a real draft (three lines, US$250.00 due) and the assistant open. At 380 x 780 px the card was capped at 328 px over 561 px of content, so the total, the sign-off and "Draft only. Nothing has been sent." sat inside the card's own scroll; Studio below it was held at its 480 px minimum, the page scrolled as well (1030 px for a 780 px screen), and Studio's chat scrolled inside that. At 1440 x 900 px the same thing happened at a larger size: the card showed 378 of its 482 px, Studio sat at 480 px and the page scrolled by 116 px.

## Decision

The card never scrolls on its own, at any width. While a draft is open the dashboard page drops its fixed height and grows: the card at its full height, then Studio at a full screen's height (the viewport less the header and the page gap). Dismiss brings back the fixed-height page.

## Alternatives considered

- **Phones only, keeping the 42% cap on wider screens.** Desktop hid the same total behind the same inner scroll and squeezed Studio the same way; one rule is also one less media query.
- **A full-screen sheet over the dashboard on phones.** One scroll while it is open, but it covers the chat and the report, needs dialog behaviour (focus kept inside, Escape) to stay accessible, and differs from wider screens.
- **A one-line "reminder ready" bar that expands on demand.** Another state, and a press before anything can be read.

## Consequences

At 380 x 780 px the whole draft fits on the first screen (it ends at 740 px); at 320 x 780 px one page scroll reaches the last line. Scrolling to the bottom shows Studio filling the screen under the header (702 px tall at 780 px high, 822 px at 900), and after Dismiss the page fits one screen again. When a draft arrives, the chat input moves down by the card's height instead of 116 px, so the provider scrolls down to keep chatting. A longer draft makes the page longer, never the card taller than its content.
