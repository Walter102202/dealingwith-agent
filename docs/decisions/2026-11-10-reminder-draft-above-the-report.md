# Reminder drafts show above the report as soon as they are ready

## Context

The Collections agent (`2026-11-10-collections-agent-amounts-from-data`) returns its payment reminder as tool data, and the chat panel renders it through `aiToolDisplay` (`ReminderDetail.tsx`). Because the lead agent delegates to Collections, the draft ends up two clicks deep: inside the collapsed "Delegated to Collections" step, then inside the collapsed "Payment reminder for …" tool row. A provider who asked for a reminder saw only "the draft is ready" and had to hunt for it.

AG Studio 3.1.0 offers no way to open a step. Its tool display has two seams only, `label` (the collapsed row) and `detail` (the body that opens on click); the docs (Tool Components) and the shipped code agree: every step starts collapsed (`AiStep.expanded = false`), and a delegation always renders its own sub-run as its body, ignoring any `detail`. There is no expanded-by-default flag, preview slot or summary slot.

## Decision

The draft tool runs in the browser, so when `draft_payment_reminder` succeeds it hands the composed reminder to the page (`draftReminderTool(getData, onDraft)`, wired through `CollectionsSource.onDraft` and `useDashboardAssistant(data, onDraft)`). `DashboardPage` shows the latest draft in a card between the dashboard header and the report (`ReminderDraftCard`), with a Dismiss button and a polite status message for screen readers. The card and the chat step render the same component (`ReminderDraft`), which formats the amounts and the total from the integer cents that `composeReminder` took from the quote data; no model text carries an amount. The chat step stays, so the draft remains in the conversation history. The agents' instructions now say the draft is shown above the report.

## Alternatives considered

- **Open the steps from outside**, by finding Studio's step rows in the DOM and clicking them when the draft arrives. It keeps the draft in the chat, but it depends on Studio's private class names and on the nested rail being built lazily, and it breaks silently on an upgrade.
- **Let the lead call the draft tool itself, without delegating.** Removes one click, not both: the tool row is still collapsed.
- **Have the model repeat the draft in its reply.** Puts the reminder, amounts included, back into model-written text, which the Collections decision exists to prevent.
- **A floating panel over the report.** Visible, but it covers the widgets the provider is looking at; a band above the report pushes them down instead and scrolls on its own past 42% of the viewport.

## Consequences

The draft appears the moment the tool finishes, without a click, on every page of the dashboard and in both the assistant and edit views. Only the latest draft is shown; earlier ones stay in the chat. Drafts replayed from a saved conversation do not reopen the card, since the tool does not run again. If a later Studio release adds an expanded-by-default option for tool steps, the card can go and the chat step can open itself instead.

The card's own scroll past 42% of the viewport is superseded by [2026-11-10 Reminder drafts read in the page's scroll](2026-11-10-reminder-draft-in-the-page-scroll.md).
