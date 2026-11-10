import type { AnthropicTurnParams } from './encode.js';
import type { AssistantLlm } from './port.js';
import type { RawStreamEvent } from './stream.js';

/**
 * Test double for {@link AssistantLlm}: replays a scripted Anthropic stream and
 * records every request. Events carry only the fields the translator reads, so
 * they are cast once here rather than spelled out in full in every test.
 */

export type ScriptBlock =
  | { text: string }
  | { thinking: string }
  | { tool: { id: string; name: string; json: string[] }; unterminated?: true }
  | { fallback: { from: string; to: string } };

export type Script = {
  id?: string;
  model?: string;
  blocks: ScriptBlock[];
  stopReason?: string;
  refusalCategory?: string;
  usage?: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  /** Ends the stream before `message_stop`, as a dropped connection would. */
  cut?: true;
};

const event = (value: unknown) => value as RawStreamEvent;

export function scriptEvents(script: Script): RawStreamEvent[] {
  const usage = script.usage ?? { input: 10, output: 5 };
  const events: RawStreamEvent[] = [
    event({
      type: 'message_start',
      message: {
        id: script.id ?? 'msg_1',
        model: script.model ?? 'claude-sonnet-5-5',
        usage: {
          input_tokens: usage.input,
          output_tokens: 1,
          cache_read_input_tokens: usage.cacheRead ?? 0,
          cache_creation_input_tokens: usage.cacheWrite ?? 0,
        },
      },
    }),
  ];
  script.blocks.forEach((block, index) => {
    if ('text' in block) {
      events.push(
        event({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } }),
      );
      for (const piece of chunk(block.text))
        events.push(
          event({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } }),
        );
    } else if ('thinking' in block) {
      events.push(
        event({
          type: 'content_block_start',
          index,
          content_block: { type: 'thinking', thinking: '' },
        }),
      );
      if (block.thinking)
        events.push(
          event({
            type: 'content_block_delta',
            index,
            delta: { type: 'thinking_delta', thinking: block.thinking },
          }),
        );
      events.push(
        event({
          type: 'content_block_delta',
          index,
          delta: { type: 'signature_delta', signature: 'sig' },
        }),
      );
    } else if ('tool' in block) {
      const { id, name, json } = block.tool;
      events.push(
        event({
          type: 'content_block_start',
          index,
          content_block: { type: 'tool_use', id, name, input: {} },
        }),
      );
      for (const partial_json of json)
        events.push(
          event({
            type: 'content_block_delta',
            index,
            delta: { type: 'input_json_delta', partial_json },
          }),
        );
      if (block.unterminated) return;
    } else {
      events.push(
        event({
          type: 'content_block_start',
          index,
          content_block: {
            type: 'fallback',
            from: { model: block.fallback.from },
            to: { model: block.fallback.to },
          },
        }),
      );
    }
    events.push(event({ type: 'content_block_stop', index }));
  });
  if (script.cut) return events;
  events.push(
    event({
      type: 'message_delta',
      delta: {
        stop_reason: script.stopReason ?? 'end_turn',
        stop_details: script.refusalCategory
          ? { type: 'refusal', category: script.refusalCategory }
          : null,
      },
      usage: { output_tokens: usage.output, input_tokens: null },
    }),
    event({ type: 'message_stop' }),
  );
  return events;
}

/** Splits text into two deltas so tests see streaming, not one burst. */
function chunk(text: string): string[] {
  const middle = Math.ceil(text.length / 2);
  return [text.slice(0, middle), text.slice(middle)].filter(Boolean);
}

export type FakeAssistantLlm = AssistantLlm & {
  requests: AnthropicTurnParams[];
  signals: AbortSignal[];
};

/** Answers each request with the next script; an `Error` is thrown instead (on open, or mid-stream after `afterEvents`). */
export function fakeAssistantLlm(
  ...turns: Array<Script | { error: Error; afterEvents?: Script }>
): FakeAssistantLlm {
  const requests: AnthropicTurnParams[] = [];
  const signals: AbortSignal[] = [];
  return {
    requests,
    signals,
    async open(params, signal) {
      requests.push(params);
      signals.push(signal);
      const turn = turns.shift();
      if (!turn) throw new Error('fakeAssistantLlm: no scripted turn left');
      if ('error' in turn) {
        if (!turn.afterEvents) throw turn.error;
        const partial = scriptEvents({ ...turn.afterEvents, cut: true });
        const failure = turn.error;
        return (async function* () {
          yield* partial;
          throw failure;
        })();
      }
      const events = scriptEvents(turn);
      return (async function* () {
        yield* events;
      })();
    },
  };
}
