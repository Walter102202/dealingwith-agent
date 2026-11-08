# Web styling: plain CSS with design tokens and CSS Modules

## Context

The spec leaves the UI component approach open (plain CSS, Tailwind, or a small library). The repo lints CSS with Biome 2, every package shares one `tsconfig.base.json`, and Track D runs in parallel with no integrator time to debug tooling.

## Decision

`apps/web` uses plain CSS: design tokens as custom properties in `src/styles.css` and one CSS Module per component. No Tailwind, no UI kit.

## Alternatives considered

- Tailwind v4 via `@tailwindcss/vite`: fastest for layout, but adds a plugin and non-standard at-rules (`@theme`, `@apply`) that Biome's CSS parser may reject, and a utility-class style that fights the `frontend-design` skill's intent of a distinctive visual system.
- A component library (Radix, shadcn): more code to own and theme in five days than it saves for seven pages.

## Consequences

Zero styling dependencies; Biome lints every stylesheet; the visual system lives in one tokens file. The implementer writes more CSS by hand.
