import type { AssistantConversationItem, AssistantTurnRequest } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { encodeTurn, turnKey } from './encode.js';

const user = (
  text: string,
  id = 'u1',
  role: 'user' | 'system' = 'user',
): AssistantConversationItem => ({
  id,
  kind: 'input',
  type: 'message',
  role,
  content: [{ type: 'text', text }],
  status: 'completed',
});
const said = (id: string, text: string): AssistantConversationItem => ({
  id,
  kind: 'output',
  type: 'message',
  role: 'assistant',
  status: 'completed',
  content: [{ type: 'text', text, annotations: [] }],
});
const call = (id: string, callId: string, name = 'execute_query', args = '{"q":1}') =>
  ({
    id,
    kind: 'output',
    type: 'function_call',
    callId,
    name,
    arguments: args,
    status: 'completed',
  }) satisfies AssistantConversationItem;
const result = (callId: string, output = '{"rows":3}') =>
  ({
    type: 'function_call_output',
    callId,
    output,
    status: 'completed',
  }) satisfies AssistantConversationItem;
const thought = (id: string): AssistantConversationItem => ({
  id,
  kind: 'output',
  type: 'reasoning',
  summary: [{ type: 'summary', text: 'Considering the schema' }],
});

const request = (input: AssistantConversationItem[], extra: Partial<AssistantTurnRequest> = {}) =>
  encodeTurn({ input, responseFormat: { type: 'text' }, ...extra }, 'claude-sonnet-5-5');

describe('encodeTurn', () => {
  test('sets the Sonnet 5.5 request shape: adaptive summarized thinking, low effort, caching, fallback', () => {
    const params = request([user('Hi')], { instructions: 'You are the orchestrator.' });
    expect(params).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000,
      stream: true,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'You are the orchestrator.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    });
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('tools');
    expect(params).not.toHaveProperty('tool_choice');
    expect(request([user('Hi')], { model: { id: 'x', effort: 'medium' } }).output_config).toEqual({
      effort: 'medium',
    });
  });

  test("one model turn's parallel calls share an assistant message and its results share one user message", () => {
    // Studio's own shape after running a turn: each result right after its call.
    const { messages } = request([
      user('Compare paid and unpaid'),
      thought('msg_A:0'),
      said('msg_A:1', 'Running two queries.'),
      call('msg_A:2', 'toolu_1'),
      result('toolu_1'),
      call('msg_A:3', 'toolu_2'),
      result('toolu_2', '{"rows":5}'),
      user('And by client?', 'u2'),
    ]);
    expect(messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Compare paid and unpaid' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Running two queries.' },
          { type: 'tool_use', id: 'toolu_1', name: 'execute_query', input: { q: 1 } },
          { type: 'tool_use', id: 'toolu_2', name: 'execute_query', input: { q: 1 } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"rows":3}' },
          { type: 'tool_result', tool_use_id: 'toolu_2', content: '{"rows":5}' },
          { type: 'text', text: 'And by client?' },
        ],
      },
    ]);
  });

  test('the same calls rebuilt from protocol messages group the same way', () => {
    const { messages } = request([
      user('Compare'),
      said('m1', 'Two queries.'),
      call('toolu_1', 'toolu_1'),
      call('toolu_2', 'toolu_2'),
      result('toolu_1'),
      result('toolu_2'),
    ]);
    expect(
      messages.map((m) => [m.role, (m.content as { type: string }[]).map((b) => b.type)]),
    ).toEqual([
      ['user', ['text']],
      ['assistant', ['text', 'tool_use', 'tool_use']],
      ['user', ['tool_result', 'tool_result']],
    ]);
  });

  test('calls from two model turns stay two turns', () => {
    const { messages } = request([
      user('Go'),
      call('msg_A:0', 'toolu_1'),
      result('toolu_1'),
      call('msg_B:0', 'toolu_2'),
      result('toolu_2'),
    ]);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
  });

  test('never replays thinking', () => {
    const { messages } = request([
      user('Hi'),
      thought('msg_A:0'),
      said('msg_A:1', 'Hello'),
      user('More', 'u2'),
    ]);
    const types = messages.flatMap((m) => (m.content as { type: string }[]).map((b) => b.type));
    expect(types).not.toContain('thinking');
    expect(types).not.toContain('redacted_thinking');
  });

  test('a required tool becomes auto plus an instruction; none stays none', () => {
    const tools = [
      { name: 'complete_task', description: 'Finish', parameters: { type: 'object' } },
    ];
    const forced = request([user('Hi'), said('msg_A:0', 'Done.')], {
      tools,
      toolChoice: { name: 'complete_task' },
      instructions: 'Be brief.',
    });
    expect(forced).not.toHaveProperty('tool_choice');
    expect(forced.system).toBe(
      'Be brief.\n\nYou must call the `complete_task` tool in this response.',
    );
    // The conversation ended on the model: a user turn follows instead of a prefill.
    expect(forced.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Continue. You must call the `complete_task` tool in this response.',
        },
      ],
    });
    expect(request([user('Hi')], { tools, toolChoice: 'required' }).system).toMatch(/at least one/);
    expect(request([user('Hi')], { tools, toolChoice: 'none' }).tool_choice).toEqual({
      type: 'none',
    });
  });

  test('tools keep their JSON Schema, stream their input eagerly and are not strict', () => {
    const parameters = { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] };
    const params = request([user('Hi')], {
      tools: [{ name: 'q', description: 'Query', parameters }],
    });
    expect(params.tools).toEqual([
      { name: 'q', description: 'Query', input_schema: parameters, eager_input_streaming: true },
    ]);
    expect(() =>
      request([user('Hi')], {
        tools: [{ name: 'q', description: 'Q', parameters: { type: 'array' } }],
      }),
    ).toThrow(expect.objectContaining({ code: 'assistant_invalid_tool' }));
  });

  test('refuses structured JSON responses with its own code', () => {
    expect(() =>
      encodeTurn(
        { input: [user('Hi')], responseFormat: { type: 'json', name: 'x', schema: {} } },
        'claude-sonnet-5-5',
      ),
    ).toThrow(expect.objectContaining({ code: 'assistant_unsupported_format', status: 400 }));
  });

  test('repairs histories a cancelled run leaves behind', () => {
    const { messages } = request([
      result('toolu_orphan'),
      call('msg_A:0', 'toolu_1'),
      user('Never mind', 'u2'),
    ]);
    expect(messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Continue.' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'execute_query', input: { q: 1 } }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: 'No result was recorded for this call.',
            is_error: true,
          },
          { type: 'text', text: 'Never mind' },
        ],
      },
    ]);
  });

  test('system messages join the system prompt; odd call ids and arguments are made valid', () => {
    const params = request([
      user('Use US$.', 's1', 'system'),
      user('Hi', 'u2'),
      call('seed', 'call.1/x', 'view_page', 'not json'),
      result('call.1/x'),
    ]);
    expect(params.system).toBe('Use US$.');
    expect(params.messages[1]?.content).toEqual([
      { type: 'tool_use', id: 'call_1_x', name: 'view_page', input: {} },
    ]);
    expect(params.messages[2]?.content).toEqual([
      { type: 'tool_result', tool_use_id: 'call_1_x', content: '{"rows":3}' },
    ]);
  });
});

describe('turnKey', () => {
  test('reads the message id out of the item ids this backend mints', () => {
    expect(turnKey('msg_01ABC:12')).toBe('msg_01ABC');
    expect(turnKey('toolu_1')).toBeUndefined();
    expect(turnKey(undefined)).toBeUndefined();
  });
});
