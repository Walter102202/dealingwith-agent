import { describe, expect, test } from 'vitest';
import {
  AssistantTurnFrameSchema,
  AssistantTurnRequestSchema,
  AssistantTurnResponseSchema,
} from './assistant.js';

const userMessage = {
  id: 'u1',
  kind: 'input',
  type: 'message',
  role: 'user',
  content: [{ type: 'text', text: 'How many quotes are unpaid?' }],
  status: 'completed',
};

describe('AssistantTurnRequestSchema', () => {
  test('accepts a turn with history, tools, a forced tool and an effort', () => {
    const request = AssistantTurnRequestSchema.parse({
      input: [
        userMessage,
        {
          id: 'msg_1:0',
          kind: 'output',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'text', text: 'Checking.', annotations: [] }],
        },
        {
          id: 'msg_1:1',
          kind: 'output',
          type: 'function_call',
          callId: 'toolu_1',
          name: 'view_schema',
          arguments: '{}',
          status: 'completed',
        },
        {
          type: 'function_call_output',
          callId: 'toolu_1',
          output: '{"ok":true}',
          status: 'completed',
        },
        { id: 'r1', kind: 'output', type: 'reasoning', summary: [{ type: 'summary', text: 'Hm' }] },
      ],
      instructions: 'You are the orchestrator.',
      tools: [{ name: 'view_schema', description: 'Schema', parameters: { type: 'object' } }],
      toolChoice: { name: 'complete_task' },
      responseFormat: { type: 'text' },
      model: { id: 'claude-sonnet-5-5', effort: 'medium' },
    });
    expect(request.input).toHaveLength(5);
    expect(request.model?.effort).toBe('medium');
  });

  test('refuses efforts outside the allow-list and attachments', () => {
    const base = { input: [userMessage], responseFormat: { type: 'text' } };
    expect(AssistantTurnRequestSchema.safeParse(base).success).toBe(true);
    expect(
      AssistantTurnRequestSchema.safeParse({ ...base, model: { id: 'x', effort: 'max' } }).success,
    ).toBe(false);
    const image = { ...userMessage, content: [{ type: 'image', detail: 'auto', imageUrl: 'x' }] };
    expect(AssistantTurnRequestSchema.safeParse({ ...base, input: [image] }).success).toBe(false);
  });

  test('refuses provider-hosted tools', () => {
    const result = AssistantTurnRequestSchema.safeParse({
      input: [userMessage],
      responseFormat: { type: 'text' },
      tools: [{ name: 'web', description: 'Web', parameters: {}, kind: 'provided' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('AssistantTurnFrameSchema', () => {
  test('parses content events and both terminal frames', () => {
    expect(
      AssistantTurnFrameSchema.parse({ type: 'TOOL_CALL_ARGS', toolCallId: 't', delta: '{"a' }),
    ).toMatchObject({ type: 'TOOL_CALL_ARGS' });
    const done = AssistantTurnFrameSchema.parse({
      type: 'done',
      response: {
        id: 'msg_1',
        createdAt: 1,
        status: 'completed',
        output: [],
        usage: { inputTokens: 10, outputTokens: 2 },
        model: 'claude-sonnet-5-5',
      },
    });
    expect(done.type).toBe('done');
    const error = AssistantTurnFrameSchema.parse({
      type: 'error',
      error: { code: 'assistant_refused', message: 'Declined' },
    });
    expect(error).toMatchObject({ error: { code: 'assistant_refused' } });
    expect(AssistantTurnFrameSchema.safeParse({ type: 'RUN_STARTED' }).success).toBe(false);
  });

  test('an incomplete turn names its reason', () => {
    const response = AssistantTurnResponseSchema.parse({
      id: 'msg_2',
      createdAt: 1,
      status: 'incomplete',
      incompleteDetails: { reason: 'max_output_tokens' },
      output: [],
    });
    expect(response.incompleteDetails?.reason).toBe('max_output_tokens');
  });
});
