# Header: the session actions fold into a Menu pill on phones

## Context

The floating pill header (`2026-11-09-geist-type-and-pill-shapes`) holds the wordmark and the session actions: Storefront, the signed-in name and role, Dashboard and "Reset demo data" for the provider, and "Sign out" (or "Demo sign in" for a visitor). Measured in a browser on 2026-11-10, a provider's actions need 267 px next to the wordmark; the pill leaves them 193 px at a 380 px viewport and 133 px at 320 px. An earlier pass let the actions scroll sideways inside the pill below 600 px, which hid "Sign out" until the reader swiped, and it already dropped the provider's Storefront link and name below 840 px and the client's Storefront link below 420 px, so those actions were not reachable from the header on a phone at all.

## Decision

At 600 px and below, the session actions move into a panel under the pill, opened from a "Menu" pill button (`aria-expanded`, `aria-controls`). The panel lists every action for the role: the name and role first, then Storefront, Dashboard, "Reset demo data" with its full label, and "Sign out" (or Storefront and "Demo sign in" for a visitor), in 44 px rows. It closes on Escape (focus back on Menu), on a press outside the header, and once an action in it is used. Above 600 px the markup and the styles render the pill exactly as before; the measured positions at 768 px and 1280 px did not move. The panel is opaque white with the pill's ring and shadow, since a backdrop blur nested inside the pill's own blur does not reach the page behind it.

## Alternatives considered

- **Icon-only buttons on phones** (Reset and Sign out as icons, tighter gaps). It fits 380 px and, with Dashboard as an icon too, 320 px, but it leaves Storefront and the name unreachable and makes every action a guess from its icon.
- **Let the pill wrap to two rows.** The provider's three actions still need 267 px on the second row, more than 320 px leaves after the padding, and a two-row pill is no longer a pill.
- **Keep the sideways scroll and add a fade at the edge.** It signals the hidden actions but still hides them.

## Consequences

Every header action is one tap behind Menu on a phone, for every role, with no horizontal scrolling at 320 px. The short "Reset" label and the 420 px rule are gone, since the menu has room for the full label. Between 600 and 840 px the pill still drops the provider's name and Storefront link as before; widening the menu to that range would change the 768 px header.
