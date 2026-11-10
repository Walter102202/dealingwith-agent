# Dashboard assistant: Claude through the backend with the official SDK

## Context

On 2026-11-10 the provider dashboard (`/dashboard`, AG Studio 3.1.0) gained AG Studio's AI assistant, to compete for the hackathon's "Best Use of AG Grid" prize. Studio never talks to a model itself: it calls an `AgLlmAdapter` in the browser, one `executeTurn(request)` per model turn, and expects a stream of AG content events plus a settled `AgLlmResponse`. AG ships only an OpenAI example adapter. The product owner chose Claude Sonnet 5.5 for the assistant. The API key cannot reach the browser, and the hosted demo lets any visitor in as the provider.

## Decision

- **The backend owns everything Anthropic.** `POST /api/dashboard/assistant/turn` (provider session) takes the AG turn request, calls Claude with the official `@anthropic-ai/sdk` (pinned at 1.7.0, streaming through `client.beta.messages.create({ stream: true })`), and streams back SSE frames: AG content events, then one terminal `done` frame with the settled response or one `error` frame with `{ code, message }`. The browser adapter (`apps/web/src/dashboard/assistant/`) only posts the request and replays the frames.
- **The wire format lives in contracts** (`packages/contracts/src/assistant.ts`), field for field the subset of AG's types this product supports, so the web adapter type-checks it against `ag-studio` while the backend never imports `ag-studio`. Text messages only (no attachments), client tools only.
- **Translation in small modules** under `apps/backend/src/assistant/`: `encode.ts` (AG request to Anthropic parameters), `stream.ts` (Anthropic stream events to AG events and the settled turn), `port.ts` (the SDK behind an `AssistantLlm` port on `Deps`, so tests inject a scripted stream), `turn.ts` (cap, open, frames, one log line per turn).
- **Model and settings.** `ASSISTANT_MODEL`, default `claude-sonnet-5-5`; the quoting agent keeps `LLM_PROVIDER`/`LLM_MODEL`. The assistant is on exactly when `ANTHROPIC_API_KEY` is set, whatever `LLM_PROVIDER` says, and `/api/config` reports `assistant.enabled`. The browser's model id is ignored (the server owns the model); its effort is allow-listed to `low | medium`, default `low`. Adaptive thinking with `display: "summarized"` (Sonnet 5.5 rejects `disabled`), mapped to AG reasoning events so the chat shows progress; `max_tokens` 16000; top-level `cache_control`; no `temperature`; no prefill.
- **Sonnet 5.5 specifics.** Forced `tool_choice` (`any`/`tool`) is a 400, so AG's `required` or `{ name }` become `auto` plus a system instruction, and a conversation that ends on the model gets a short user turn instead of a prefill; `none` stays `none`. Tool schemas pass through as `input_schema` with `eager_input_streaming: true` and no `strict` (AG validates arguments and feeds errors back). A turn that stops on `refusal`, on `max_tokens` while carrying a tool call, or on the context window fails with its own code instead of returning truncated output.
- **Refusal fallback on.** Requests send `fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta; a mid-turn fallback keeps the text before it and drops tool calls started before it.
- **`responseFormat: json` is refused** (`assistant_unsupported_format`): `ag-studio@3.1.0`'s built-in loop only ever sends `{ type: "text" }` (checked in `dist/package/main.esm.mjs`, `LlmTurnSource.turn`).

## Alternatives considered

- **The Vercel AI SDK already in the backend.** It hides the Anthropic stream events this adapter must map one to one (thinking summaries, `input_json_delta`, fallback blocks) and lags new API fields such as `fallbacks`; the official SDK types them.
- **A browser adapter calling Anthropic directly.** It would need the key in the browser.
- **A generic proxy forwarding Anthropic's wire format to the browser.** It would move the translation, the caps and the model choice into code any visitor can rewrite.
- **`client.beta.messages.stream()` with `finalMessage()`.** With eager input streaming its accumulator rejects a turn whose tool input is not valid JSON; AG wants the raw argument string and reports the error to the model itself, so the raw event stream is translated instead.

## Consequences

A new dependency (`@anthropic-ai/sdk`, which brings `@opentelemetry/api`). The assistant needs no new secret: the existing capped `ANTHROPIC_API_KEY` covers it, bounded per day by `2026-11-10-assistant-daily-turn-cap`. Thinking is never replayed (`2026-11-10-assistant-no-thinking-replay`). A future AG release that sends JSON response formats needs `output_config.format` support here. CI never calls the model: every test runs on a scripted stream.
