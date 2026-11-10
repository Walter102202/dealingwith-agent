# Header: the Menu pill from 840 px down, for every role

Supersedes the breakpoint of [2026-11-10 Header: the session actions fold into a Menu pill on phones](2026-11-10-header-menu-on-phones.md) (600 px, chosen to keep the 768 px header unchanged); the menu itself, its contents and how it opens and closes stand.

## Context

Between 601 and 840 px the pill hid the signed-in name for every role and the provider's Storefront link, and the Menu pill only started at 600 px, so a provider on a portrait tablet could not see their name or reach Storefront, and a client could not see theirs. The owner wants them reachable, and the constraint of keeping the 768 px header unchanged was lifted on 2026-11-10.

Measured in Chromium on 2026-11-10 with the demo sessions, Geist loaded and a 15 px classic scrollbar, the pill leaves the session actions 414 px at a 601 px viewport, 513 px at 700, 581 px at 768, 653 px at 840 and 654 px at 841 (the viewport minus about 187 px). With nothing hidden, the actions need 635 px for the provider (name and role, Storefront, Dashboard, "Reset demo data", "Sign out"), 309 px for a client (Storefront, name and role, "Sign out") and 199 px for a signed-out visitor (Storefront, "Demo sign in"). The client and the visitor fit at every width from 601 px; the provider fits only from a viewport of about 822 px.

## Decision

The Menu pill and its panel apply at 840 px and below for every role, and the rule that hid the name and the provider's Storefront link between 601 and 840 px is gone. At every width each session action is either in the pill or one tap away in the menu; above 840 px the pill shows all of them, as before.

## Alternatives considered

- **A breakpoint per role** (840 px for the provider, 600 px for client and visitor). It spares the client and the visitor one tap between 601 and 840 px, but it needs the panel styles twice, one media query per breakpoint, or a script that picks the breakpoint from the role. One rule keeps one breakpoint to test and the same header for every role on a tablet. Visitors meet the landing page's own header first, and the storefront body links to the demo sign in.
- **Keep 600 px and fit the provider's pill between 600 and 840 px** with shorter labels or no role tag. At 601 px the pill leaves 414 px for actions that need 635 px; no trimming that keeps every action visible closes that gap.
- **Fold only when the pill overflows**, measured with a `ResizeObserver`. It adapts to any business name, but it adds a layout-reading hook and a first paint before the measurement; the demo's names are fixed.

## Consequences

Between 601 and 840 px every role reaches its session actions through Menu, including the client and the visitor whose links would fit; the 768 px header now shows the wordmark and the Menu pill. 320, 380 and 1280 px render as before. The `hideBelowTablet` class is gone. The provider's pill has 19 px to spare at 841 px with "Andes Data Studio" as the name; a longer business name would need this breakpoint measured again.
