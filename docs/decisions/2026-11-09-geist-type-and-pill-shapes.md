# Geist type, pill controls and floating header; colours unchanged

## Context

Reviewing the web on 2026-11-09, David found the look too close to a stock "AI product" style: a serif display face (Fraunces) over a cream paper background. He asked for something more polished and premium, taking the structure, motion and components of the Unbidden landing page (`~/unbidden-landingpage`) as the reference, and explicitly asked to keep the light theme and the current colours for now.

## Decision

- **Type.** Geist and Geist Mono replace Fraunces and IBM Plex Sans in every page and in the AG Studio theme. The two variable `woff2` files and their SIL OFL 1.1 licences are self-hosted in `apps/web/public/fonts/`; `index.html` preloads Geist and no longer calls Google Fonts. Headings use weight 600 with tight tracking; quote totals keep the large size in Geist.
- **Shapes and motion.** Buttons and badges are pills; buttons scale to 0.965 on press. Cards use an 18 px radius and a softer shadow. The app header is a floating translucent pill. Clause ids in the scope list use the mono face.
- **Colours.** Every colour token in `src/styles.css` keeps its value. Colour is a separate decision for later.
- **Landing structure.** Centred display hero; the project page replayed in a window frame (typing, quote, PayPal capture, clause C4 joining the scope); eyebrow + claim + lede section heads; an agent terminal replaying demo requests 2 to 5 from "Try it" chips; a mandate meter; reveals that rise out of a soft blur once. CSS animation only; with reduced motion the replays show their final frame and reveals are off.

## Alternatives considered

- **A dark landing like Unbidden's.** Rejected by David for now: the product stays light.
- **New colours with the new type.** Deferred by David to a later pass.
- **Geist from Google Fonts or `@fontsource`.** Self-hosting two files avoids a third-party request and a new dependency.

## Consequences

The app looks different without any behaviour change; tests are unaffected apart from the landing's own. The dashboard widgets render in Geist. Changing the palette later only touches the tokens and `dashboard/theme.ts`.
