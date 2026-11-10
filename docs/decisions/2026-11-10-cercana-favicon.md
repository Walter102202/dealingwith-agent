# Cercana favicon

## Context

On 2026-11-10 Walter selected the Cercana variation of Acuerdo: a D formed by two complementary white pieces with curved joins on the existing pine-green tile. He asked to use it as the favicon and authorized merging the change. The previous favicon was an inline SVG containing a Georgia letter, while the interface had already moved to Geist.

## Decision

Use `apps/web/public/favicon.svg` as the editable source for the selected mark, keeping the existing `#0E6B52` and white palette. Replace the inline favicon with root-relative links to that SVG, an ICO containing 16, 32 and 48 pixel images, and a 180 pixel Apple touch icon.

## Alternatives considered

- Keep the serif initial: it does not represent the approved design.
- Ship a crop of the generated proposal board: presentation artwork is not a clean, scalable browser icon.
- Load a font or external image: the favicon should render independently of fonts, scripts and third-party services.
- Change the landing and app wordmarks in the same commit: this request selects the favicon; other brand surfaces can be updated separately.

## Consequences

The artwork is self-contained and uses geometric paths rather than text. The two curved separations are kept open at small sizes; the SVG and ICO are inspected at actual 16 and 32 pixel sizes on light and dark backgrounds before merge. Raster exports come from the SVG and must be regenerated together if its geometry changes.

Vite copies the files from `public/` into the production build. Root-relative references also work from nested app routes. There are no new application dependencies, no runtime logic changes and no changes to payments, agent behavior or the existing color tokens. Existing CI gates remain required.
