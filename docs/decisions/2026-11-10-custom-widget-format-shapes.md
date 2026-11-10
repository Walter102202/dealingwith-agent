# Custom widgets get format shapes, so the assistant can restyle them

Supersedes the `formatShape` consequence of [2026-11-10 three custom AG Studio widgets](2026-11-10-studio-custom-widgets.md) ("the widgets define no `formatShape`, so Studio's AI assistant cannot restyle them yet"); the rest of that decision stands.

## Context

AG Studio's AI agents restyle a widget by writing its `format`, and they learn what a widget accepts from its definition's `formatShape`; a widget without one can be mapped but not styled. The three DealingWith widgets (quotes table, agent budget, KPI tile) had none. Two facts about Studio 3.1.0 shaped the work, both read from the installed types and code:

- A format shape is also the parser Studio runs on a widget's `format` before loading it, and it drops every key it does not declare. A shape that declared only our style options would silently erase the titles, subtitles and cross-filter settings the saved report and the edit form write.
- `formatShape` receives only `{ api, context }`, and the package exports no shape builder. Studio hands its builder to `api.defineAiCommand(factory)` callbacks and nowhere else public; Studio's own shapes are built internally.

## Decision

Each custom widget declares a `formatShape` built by `widgets/format-shape.ts`: every key of Studio's widget format, mirroring Studio's own declarations, so the parser drops none of them (`title`, `subtitle` and `caption` with typography, colour, alignment and wrapping; the card appearance `widget`; `crossFilter` and `triggerCrossFilter`), and the widget's `style`. The style options are small and each changes what renders:

- Quotes table: `totalRow` (pinned total row), `density` (`compact` rows are 32 px and drop the project line under the client).
- Agent budget: `showBar`, `showPerPurchase`, `showStatus`, `showExpires`.
- KPI tile: `valueSize` (`compact`, `regular`, `large`: the number, not the tile), `showCount`, and the existing `countOne` and `countMany`.

The edit form gains the matching controls (a checkbox or select per option). The builder is borrowed from `defineAiCommand` once per Studio instance (`shapeBuilder`); the command it defines is discarded. Each widget's `ai.configuration` describes its options and tells Studio's Widget agent that `configure_widget` replaces `format` as a whole, so it must resend the current titles and cross-filter with any style change.

## Alternatives considered

- **Declare only `style`.** Smaller, but the parser would drop every title in the saved report on load.
- **Hand-build an `AgShape` object.** Studio unwraps a shape to its internal core (`coreOf`), which the public types mark as not part of the contract; imitating it is far more fragile than borrowing the builder through a public method.
- **Title and subtitle as our own style options.** Studio already draws and edits widget titles for every widget; declaring its title shape keeps one way to title a widget.
- **Merge format changes on the host** (restore titles when an AI edit drops them). It would second-guess a user who asked to remove a title.

## Consequences

Verified live on 2026-11-10: asked to make the Unpaid additionals table compact and hide its total row, the Widget agent set `density` and `totalRow` and the table redrew. That first run also cleared the table's title, because the agent sent `format` with only the style; with the replace rule in `ai.configuration`, a second run on a KPI tile kept its title, typography and colour. The rule is guidance to a model, not a guarantee: an agent can still drop a title, and Undo restores it. In the same run "make the tile large" was read as the tile's size on the page, which is why the option is named `valueSize` and described as the number only. Asked for a card background and border on the agent budget in the same request as hiding its bar, the assistant hid the bar, kept the titles and declined the background: Studio 3.1.0's own lead-agent instructions list widget chrome (background colour, corner radius) as unsupported for every widget, so `widget` is declared to keep what the state holds, not to open that to the assistant. If a later Studio release exports a shape builder, `shapeBuilder` should use it. Adding a style option now means declaring it in the shape as well as in the form, or Studio drops it.

The replace rule in `ai.configuration`, the "merge format changes on the host" alternative and the "guidance, not a guarantee" consequence are superseded by [2026-11-10 an assistant restyle keeps the format keys it leaves out](2026-11-10-restyle-keeps-format-keys.md).
