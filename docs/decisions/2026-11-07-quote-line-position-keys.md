# Quote line position keys

## Context

W2 prescribes position-and-kind keys because quote labels can repeat. Biome prohibits array-index keys by default.

## Decision

Keep the plan's keys and suppress only that lint check on the line, with the invariant stated: line order is fixed within a quote version.

## Alternatives considered

- Label keys collide for valid quotes.
- Adding line IDs changes the frozen contracts and exceeds this task's scope.

## Consequences

Repeated labels render safely. If quote lines later become reorderable, replace position keys with stable line IDs.
