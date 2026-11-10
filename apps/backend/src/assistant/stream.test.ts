import type { AssistantConversationItem } from '@dealingwith/contracts';
import { AssistantTurnResponseSchema } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { encodeTurn } from './encode.js';
import { type Script, scriptEvents } from './fake-llm.js';
import { TurnTranslator } from './stream.js';

function run(script: Script) {
  const translator = new TurnTranslator(1_700_000_000_000);
  const events = scriptEvents(script).flatMap((e) => translator.translate(e));
  return { events, outcome: translator.finish(), summary: translator.summary() };
}

describe('TurnTranslator', () => {
  test('streams text as one AG message and settles it with usage', () => {
    const { events, outcome } = run({
      blocks: [{ text: 'Three quotes are unpaid.' }],
      usage: { input: 100, output: 20, cacheRead: 400, cacheWrite: 50 },
    });
    expect(events).toEqual([
      { type: 'TEXT_MESSAGE_START', messageId: 'msg_1:0', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_1:0', delta: 'Three quotes' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_1:0', delta: ' are unpaid.' },
      { type: 'TEXT_MESSAGE_END', messageId: 'msg_1:0' },
    ]);
    expect(outcome).toEqual({
      ok: true,
      response: {
        id: 'msg_1',
        createdAt: 1_700_000_000_000,
        status: 'completed',
        model: 'claude-sonnet-5-5',
        output: [
          {
            id: 'msg_1:0',
            kind: 'output',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'text', text: 'Three quotes are unpaid.', annotations: [] }],
          },
        ],
        usage: {
          inputTokens: 550,
          outputTokens: 20,
          totalTokens: 570,
          cachedInputTokens: 400,
          cacheWriteTokens: 50,
        },
      },
    });
    if (outcome.ok) expect(AssistantTurnResponseSchema.parse(outcome.response)).toBeTruthy();
  });

  test('maps summarized thinking to reasoning events; an empty thought is not kept', () => {
    const { events, outcome } = run({
      blocks: [{ thinking: 'Checking statuses' }, { thinking: '' }, { text: 'Done' }],
    });
    expect(events.slice(0, 3)).toEqual([
      { type: 'REASONING_MESSAGE_START', messageId: 'msg_1:0', role: 'reasoning' },
      { type: 'REASONING_MESSAGE_CONTENT', messageId: 'msg_1:0', delta: 'Checking statuses' },
      { type: 'REASONING_MESSAGE_END', messageId: 'msg_1:0' },
    ]);
    expect(outcome.ok && outcome.response.output.map((item) => item.type)).toEqual([
      'reasoning',
      'message',
    ]);
  });

  test('streams parallel tool calls with their argument fragments', () => {
    const { events, outcome, summary } = run({
      stopReason: 'tool_use',
      blocks: [
        { tool: { id: 'toolu_a', name: 'execute_query', json: ['{"field', '":"status"}'] } },
        { tool: { id: 'toolu_b', name: 'view_schema', json: [] } },
      ],
    });
    expect(events).toEqual([
      { type: 'TOOL_CALL_START', toolCallId: 'toolu_a', toolCallName: 'execute_query' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'toolu_a', delta: '{"field' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'toolu_a', delta: '":"status"}' },
      { type: 'TOOL_CALL_END', toolCallId: 'toolu_a' },
      { type: 'TOOL_CALL_START', toolCallId: 'toolu_b', toolCallName: 'view_schema' },
      { type: 'TOOL_CALL_END', toolCallId: 'toolu_b' },
    ]);
    expect(outcome.ok && outcome.response.output).toEqual([
      expect.objectContaining({
        id: 'msg_1:0',
        callId: 'toolu_a',
        arguments: '{"field":"status"}',
      }),
      expect.objectContaining({ id: 'msg_1:1', callId: 'toolu_b', arguments: '{}' }),
    ]);
    expect(summary).toMatchObject({ toolCalls: 2, stopReason: 'tool_use', fellBack: false });
  });

  test('tool results round trip: the settled turn plus Studio results encode as one call turn', () => {
    const { outcome } = run({
      stopReason: 'tool_use',
      blocks: [
        { thinking: 'Two lookups' },
        { text: 'Looking.' },
        { tool: { id: 'toolu_a', name: 'execute_query', json: ['{"a":1}'] } },
        { tool: { id: 'toolu_b', name: 'execute_query', json: ['{"b":2}'] } },
      ],
    });
    if (!outcome.ok) throw new Error('turn failed');
    // What Studio's loop appends after running the calls (outputItemsToConversationItems).
    const history: AssistantConversationItem[] = [
      {
        id: 'u',
        kind: 'input',
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: 'Q' }],
        status: 'completed',
      },
    ];
    for (const item of outcome.response.output) {
      history.push(item);
      if (item.type === 'function_call')
        history.push({
          type: 'function_call_output',
          callId: item.callId,
          output: `r-${item.callId}`,
          status: 'completed',
        });
    }
    const { messages } = encodeTurn({ input: history, responseFormat: { type: 'text' } }, 'm');
    expect(messages.slice(1)).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Looking.' },
          { type: 'tool_use', id: 'toolu_a', name: 'execute_query', input: { a: 1 } },
          { type: 'tool_use', id: 'toolu_b', name: 'execute_query', input: { b: 2 } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_a', content: 'r-toolu_a' },
          { type: 'tool_result', tool_use_id: 'toolu_b', content: 'r-toolu_b' },
        ],
      },
    ]);
  });

  test('a refusal fails the turn and names the category', () => {
    const { outcome } = run({ blocks: [], stopReason: 'refusal', refusalCategory: 'cyber' });
    expect(outcome).toEqual({
      ok: false,
      error: { code: 'assistant_refused', message: expect.stringContaining('(cyber)') },
    });
  });

  test('max_tokens with a tool call fails; with text only the turn is incomplete', () => {
    const cutCall = run({
      stopReason: 'max_tokens',
      blocks: [
        { tool: { id: 'toolu_a', name: 'add_widget', json: ['{"type":"ba'] }, unterminated: true },
      ],
    });
    expect(cutCall.outcome).toMatchObject({
      ok: false,
      error: { code: 'assistant_truncated_tool_call' },
    });
    const cutText = run({ stopReason: 'max_tokens', blocks: [{ text: 'A long ans' }] });
    expect(cutText.outcome).toMatchObject({
      ok: true,
      response: { status: 'incomplete', incompleteDetails: { reason: 'max_output_tokens' } },
    });
  });

  test('a stream that ends before message_stop fails', () => {
    const { outcome } = run({ blocks: [{ text: 'Half' }], cut: true });
    expect(outcome).toMatchObject({ ok: false, error: { code: 'assistant_stream_interrupted' } });
  });

  test('after a mid-turn fallback, earlier tool calls are closed and dropped', () => {
    const { events, outcome, summary } = run({
      stopReason: 'tool_use',
      blocks: [
        { text: 'Let me' },
        { tool: { id: 'toolu_old', name: 'execute_query', json: ['{"x'] }, unterminated: true },
        { fallback: { from: 'claude-sonnet-5-5', to: 'claude-sonnet-5' } },
        { tool: { id: 'toolu_new', name: 'execute_query', json: ['{}'] } },
      ],
    });
    expect(events).toContainEqual({ type: 'TOOL_CALL_END', toolCallId: 'toolu_old' });
    expect(
      outcome.ok &&
        outcome.response.output.map((i) => (i.type === 'function_call' ? i.callId : i.type)),
    ).toEqual(['message', 'toolu_new']);
    expect(outcome.ok && outcome.response.model).toBe('claude-sonnet-5');
    expect(summary).toMatchObject({ fellBack: true, toolCalls: 1 });
  });
});
