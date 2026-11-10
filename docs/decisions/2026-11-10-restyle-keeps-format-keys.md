# An assistant restyle keeps the format keys it leaves out

Supersedes three parts of [2026-11-10 custom widgets get format shapes](2026-11-10-custom-widget-format-shapes.md): the replace rule each widget's `ai.configuration` carried, the rejected alternative "merge format changes on the host", and the consequence that keeping titles is "guidance to a model, not a guarantee". The shapes, the style options and the borrowed builder stand.

## Context

On 2026-11-10 the assistant erased the title, subtitle and cross filter of the "Unpaid additionals" table while making it compact. Studio 3.1.0's `configure_widget` writes a widget through a one-level patch (`ObjectPatchMutation`, `dist/package/main.esm.mjs` lines 103337-103357, used by `createConfigureWidgetCommand` at 113743-113764): every key the call sends replaces the current one whole, so a `format` holding only `style` replaces the whole format. The fix in place was a sentence in each widget's `ai.configuration` asking the Widget agent to resend the current keys; it worked once and guaranteed nothing.

The earlier decision rejected restoring keys on the host because it would second-guess a provider who asked to remove a title. That objection holds only if "left out" and "removed" look the same. They do not: Studio's title shape (`AgTitle.enabled`, `dist/types/api/widgets/shared/agTitle.d.ts`) has an explicit off switch, `optional()` rejects `null` (main.esm.mjs 102529), and the edit form hides a title by turning `enabled` off while keeping its text (`titleGroupFragment`, 129531-129559).

A public hook exists. An agent definition is a plain object whose `tools(ctx, params)` returns `AgAiTool` values with a public `execute(call, ctx)` (`dist/types/api/ai/agAiAgent.d.ts` lines 18-84, `agAiTool.d.ts` lines 63-118), and Studio's loop looks tools up by name from that list on every turn and calls `execute` (main.esm.mjs 143239-143257 and 143361). Our harness already spreads `builtIn.lead` this way to add Collections. The Widget agent is the only agent given `configure_widget` (`widgetAgentDefinition`, 148876-148893), and the edit form never goes through that tool.

## Decision

The harness wraps AG's Widget agent (`assistant/keep-format.ts`, `widgetKeepingFormat`). Its `configure_widget` fills every top-level `format` key the call leaves out with the widget's current value before Studio applies the patch; a key the call sends wins as sent, whatever its value. So a restyle that sends only `style` keeps the titles, card and cross filter, and "remove the title" arrives as `title: { enabled: false, text }` and is applied. The rule covers every widget type, built-in charts included: every Studio format shape declares the same `title`, `subtitle`, `caption` and `widget` keys, so nothing type-specific is needed. It also keeps `style` (and a chart's `seriesLimit`) when a call leaves it out, so renaming a widget does not reset its density or legend; an agent resets a style by sending `style: {}`. Calls without a `format`, for a widget that is not on the page, or that change the widget type pass through untouched.

The tool result tells the agent which keys were kept and how to hide a title, and the Widget agent's instructions carry the rule once (`KEEP_FORMAT_GUIDANCE`, moved from the widget definitions, whose replace rule is gone). The custom format shapes say a left-out property keeps its current value and that `enabled: false` hides a title and keeps its text.

## Alternatives considered

- **Keep the guidance only.** No guarantee; the model drops keys on some runs.
- **Repair the state after the fact** in `onStateUpdated` (the event carries `source: { type: 'ai' }`). A second write means a second undo entry, and the first Undo would bring back the title loss; the event is also debounced.
- **Restore in the format shape.** The shape parses the new value only and is also the parser for the edit form and the saved report; it cannot see the previous format.
- **Merge inside `title` as well.** It would keep a font or colour the agent dropped on purpose ("back to the default colour"); one level more than Studio is a rule the agent can follow from `view_widget`.
- **Only the six Studio-owned keys.** Simpler to state, but a rename would still reset `style`, the same loss in another key.

## Consequences

Verified live on 2026-11-10 with the real assistant: asked to make the table compact and hide its total row, the agent sent `format: { style: { density: 'compact', totalRow: false } }` and the table kept its title, subtitle and cross filter; asked to remove the title, it sent `title: { enabled: false, text: 'Unpaid additionals' }` and the title went; asked to move the "Unpaid by channel" donut's legend, a built-in chart, it sent only `style` and the donut kept its titles and cross filter. One configure call is still one `api.setState` and so one undo entry (labelled `historyLabelEditWidget`, source `ai`); after the compact restyle, one Undo brought back the comfortable density and the total row with the titles untouched, and a second Undo had nothing left to undo. An agent can no longer drop a format key by omission; it must send the key with an off value. The wrapper depends on the tool name `configure_widget` and its call shape `{ widgetId, op: 'patch', value: { format } }`; if a Studio upgrade changes either, calls pass through untouched (the old behaviour) and the unit tests in `keep-format.test.ts` describe what to re-check.
