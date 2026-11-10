import Anthropic from '@anthropic-ai/sdk';
import { AppConfigSchema, AssistantTurnFrameSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createDailyTurnCap } from '../../assistant/daily-cap.js';
import { type FakeAssistantLlm, fakeAssistantLlm, type Script } from '../../assistant/fake-llm.js';
import type { AssistantPort } from '../../assistant/port.js';
import type { Logger } from '../../observability/logger.js';
import { createHarness } from '../../test/workflow-harness.js';
import { createApp } from '../app.js';
import { ASSISTANT_MAX_BODY_BYTES } from './dashboard.js';

const PATH = '/api/dashboard/assistant/turn';
const SECRET_PROMPT = 'Which client owes the most?';
const body = {
  input: [
    {
      id: 'u1',
      kind: 'input',
      type: 'message',
      role: 'user',
      content: [{ type: 'text', text: SECRET_PROMPT }],
      status: 'completed',
    },
  ],
  instructions: 'You are the orchestrator.',
  responseFormat: { type: 'text' },
  model: { id: 'claude-sonnet-5-5', effort: 'medium' },
};

const lines: Array<{ msg: string; fields: Record<string, unknown> }> = [];
const logger: Logger = {
  info: (msg, fields = {}) => lines.push({ msg, fields }),
  warn: (msg, fields = {}) => lines.push({ msg, fields }),
  error: (msg, fields = {}) => lines.push({ msg, fields }),
  child: () => logger,
};
let h: Awaited<ReturnType<typeof createHarness>>;
let app: ReturnType<typeof createApp>;
let provider: string;
const login = async (role: 'provider' | 'client') =>
  (
    await app.request('/api/session/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    })
  ).headers.get('set-cookie') ?? '';
beforeAll(async () => {
  h = await createHarness({ logger });
  app = createApp(h.deps);
  provider = await login('provider');
});
afterAll(async () => {
  await h.close();
});

/** Points the shared app at a fresh assistant (or none) and clears the log. */
function setup(llm: FakeAssistantLlm | null, limit = 10) {
  const now = () => new Date('2026-11-10T12:00:00Z');
  const assistant: AssistantPort | null = llm
    ? { model: 'claude-sonnet-5-5', llm, cap: createDailyTurnCap(limit, now) }
    : null;
  h.deps.assistant = assistant;
  lines.length = 0;
  const post = (payload: unknown = body, init: RequestInit = {}, as = provider) =>
    app.request(PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: as },
      body: JSON.stringify(payload),
      ...init,
    });
  return { post, turns: () => lines.filter((l) => l.msg === 'assistant.turn') };
}

async function frames(response: Response) {
  const text = await response.text();
  return text
    .split('\n\n')
    .flatMap((chunk) => chunk.split('\n').filter((line) => line.startsWith('data:')))
    .map((line) => AssistantTurnFrameSchema.parse(JSON.parse(line.slice(5).trim())));
}

const answer: Script = { blocks: [{ thinking: 'Sum by client' }, { text: 'Acme owes the most.' }] };

describe('POST /api/dashboard/assistant/turn', () => {
  test('streams AG events and a done frame, and logs usage without the prompt', async () => {
    const llm = fakeAssistantLlm(answer);
    const { post, turns } = setup(llm);
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const all = await frames(response);
    expect(all.map((f) => f.type)).toEqual([
      'REASONING_MESSAGE_START',
      'REASONING_MESSAGE_CONTENT',
      'REASONING_MESSAGE_END',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'done',
    ]);
    expect(llm.requests[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      output_config: { effort: 'medium' },
    });
    const [line] = turns();
    expect(line?.fields).toMatchObject({
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      outcome: 'completed',
      inputTokens: 10,
      outputTokens: 5,
      stopReason: 'end_turn',
    });
    expect(JSON.stringify(line)).not.toContain(SECRET_PROMPT);
    expect(JSON.stringify(line)).not.toContain('Acme');
  });

  test('is for providers only and reports itself in the config', async () => {
    const { post } = setup(fakeAssistantLlm(answer));
    expect((await app.request(PATH, { method: 'POST' })).status).toBe(401);
    expect((await post(body, {}, await login('client'))).status).toBe(403);
    const config = AppConfigSchema.parse(await (await app.request('/api/config')).json());
    expect(config.assistant).toEqual({ enabled: true });
  });

  test('without an Anthropic key it is disabled, with its own code', async () => {
    const { post } = setup(null);
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'assistant_disabled' } });
    const config = AppConfigSchema.parse(await (await app.request('/api/config')).json());
    expect(config.assistant).toEqual({ enabled: false });
  });

  test('validates the body against the contract', async () => {
    const llm = fakeAssistantLlm(answer);
    const { post } = setup(llm);
    const response = await post({ ...body, model: { id: 'x', effort: 'max' } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'validation_error' } });
    const json = await post({ ...body, responseFormat: { type: 'json', name: 'x', schema: {} } });
    expect(await json.json()).toMatchObject({ error: { code: 'assistant_unsupported_format' } });
    expect(llm.requests).toHaveLength(0);
  });

  test('stops at the daily cap with 429 and its own code', async () => {
    const { post, turns } = setup(fakeAssistantLlm(answer, answer), 1);
    const first = await post();
    expect(first.status).toBe(200);
    await frames(first);
    const capped = await post();
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ error: { code: 'assistant_daily_limit' } });
    expect(turns().map((t) => t.fields.outcome)).toEqual(['completed', 'daily_limit']);
  });

  test('an upstream failure before streaming is a plain HTTP error', async () => {
    const rateLimited = new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers());
    const { post } = setup(fakeAssistantLlm({ error: rateLimited }));
    const response = await post();
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: 'assistant_rate_limited' } });
  });

  test('a failure mid-stream ends with an error frame', async () => {
    const overloaded = new Anthropic.InternalServerError(
      529,
      undefined,
      'overloaded',
      new Headers(),
    );
    const { post } = setup(fakeAssistantLlm({ error: overloaded, afterEvents: answer }));
    const all = await frames(await post());
    expect(all.at(-1)).toEqual({
      type: 'error',
      error: { code: 'assistant_upstream_unavailable', message: expect.any(String) },
    });
  });

  test('a refusal ends with an error frame', async () => {
    const { post } = setup(
      fakeAssistantLlm({ blocks: [], stopReason: 'refusal', refusalCategory: 'cyber' }),
    );
    const all = await frames(await post());
    expect(all).toEqual([
      { type: 'error', error: { code: 'assistant_refused', message: expect.any(String) } },
    ]);
  });

  test('refuses an oversized conversation before it reaches the model or the cap', async () => {
    const llm = fakeAssistantLlm(answer);
    const { post } = setup(llm, 1);
    const response = await post({ ...body, instructions: 'x'.repeat(ASSISTANT_MAX_BODY_BYTES) });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: 'assistant_request_too_large' },
    });
    expect(llm.signals).toHaveLength(0);
    // The single turn of today's budget is still available.
    expect((await post()).status).toBe(200);
  });

  test('aborting the request aborts the upstream call', async () => {
    const llm = fakeAssistantLlm(answer);
    const { post } = setup(llm);
    const controller = new AbortController();
    const response = await post(body, { signal: controller.signal });
    controller.abort();
    expect(llm.signals[0]?.aborted).toBe(true);
    await response.body?.cancel().catch(() => {});
  });
});

describe('createDailyTurnCap', () => {
  test('counts turns per UTC day and resets at midnight', () => {
    let clock = new Date('2026-11-10T23:59:00Z');
    const cap = createDailyTurnCap(2, () => clock);
    expect([cap.take(), cap.take(), cap.take()]).toEqual([true, true, false]);
    clock = new Date('2026-11-11T00:00:01Z');
    expect(cap.take()).toBe(true);
    expect(createDailyTurnCap(0, () => clock).take()).toBe(false);
  });
});
