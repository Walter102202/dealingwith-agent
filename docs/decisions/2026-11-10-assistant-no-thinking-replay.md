# Dashboard assistant: thinking blocks are never replayed

## Context

Claude Sonnet 5.5 runs with adaptive thinking (it cannot be disabled), and its thinking blocks are bound to the model, the account and the conversation that produced them: the API checks that the `system` prompt, the `tools` and every earlier message are unchanged since a block was produced, and on accounts created from 2026-08-31 a replay after any edit is a 400. The assistant's history comes from AG Studio, decided on 2026-11-10 (`2026-11-10-assistant-anthropic-adapter-on-backend`): AG's conversation items have no field for a thinking signature, and Studio rebuilds each agent's instructions and tool schemas from live dashboard state on every turn (the schema overview, the widget catalogue, which tools are callable), so the bound prefix changes between turns by design.

## Decision

Every request rebuilds each earlier assistant turn from its text and `tool_use` blocks only; thinking and redacted-thinking blocks are never sent back (AG's reasoning items are dropped in `apps/backend/src/assistant/encode.ts`). A history with every thinking block removed is valid on Sonnet 5.5 (the migration guide lists removing all of them as an edit that keeps later blocks valid). The reasoning summaries still reach the chat as AG reasoning events while a turn streams.

## Alternatives considered

- **Carry signatures through AG.** AG's types have no place for them, and Studio would still rebuild the system prompt and tools, so every replayed block would fail the check.
- **`prefix_mismatch_behavior: "drop_block"` (beta `thinking-binding-controls-2026-08-01`).** It would ask the API to drop what we cannot keep valid anyway, adding a beta for no gain.
- **`thinking: { type: "between_tools" }`.** Turns thinking off but keeps the same binding for its progress blocks and gives the chat nothing to show while the model works.

## Consequences

The model starts each turn without its earlier reasoning; for a dashboard assistant whose turns are short and grounded in tool results this costs little. The prompt cache still covers the stable prefix (tools, instructions, earlier text and tool calls). Nothing here edits history, so the history-editing check never fires.
