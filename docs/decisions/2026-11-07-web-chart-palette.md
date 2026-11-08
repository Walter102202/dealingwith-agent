# Web chart palette

## Context

W1 requires six product-derived chart colors. The installed AG Studio 3.1.0 declarations expose both fill and stroke palette parameters, correcting the palette limitation noted in [the earlier Studio decision](2026-11-07-ag-studio-definition-loading.md).

## Decision

Use pine accent first, followed by lighter amber, darker info blue, danger red, darker faint ink and darker deep pine. Store the six values once and use them for fills and strokes. Vary lightness as well as hue against the white widget surface.

## Alternatives considered

- Keep Studio defaults: does not meet W1's product palette requirement.
- Use only shades of pine: adjacent categories are harder to distinguish.

## Consequences

Charts share the product colors without changing data or widget definitions. The earlier decision's other Studio configuration choices remain unchanged.
