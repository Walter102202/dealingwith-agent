# AG Studio from day one, trial mode without a key

## Context

Spec section 5 makes the provider dashboard an AG Studio dashboard (sponsor prize) with a pivot to AG Grid Community plus AG Charts if the 45-day trial key is not in hand by 2026-11-09 20:00 Santiago. Checked on npm 2026-11-07: `ag-studio-react@3.1.0` exists, depends on `ag-grid-react` and `ag-grid-enterprise ~36.3`, and its README offers the trial key "with no restrictions or watermarks", which means the package renders without a key in a watermarked trial mode.

## Decision

Track D builds the dashboard on `ag-studio-react` from the start, without waiting for the key. The key, when Walter obtains it, is applied through `VITE_AG_STUDIO_LICENSE` using the entry point the installed package documents. The pivot rule narrows to one condition: AG Studio does not render at all without a key by the pivot date.

## Alternatives considered

- Build the fallback first and swap to Studio when the key arrives: two dashboards for one demo, and the sponsor-prize feature arrives last.
- Wait for the key before touching D6: idles the track on a manual step.

## Consequences

D6 can start on 2026-11-08. A watermark is acceptable until the key arrives. The task records the saved-definition and license entry points it finds in a decision file so the integrator can review them.
