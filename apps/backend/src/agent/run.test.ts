import type { ContextPack } from '@dealingwith/contracts';
import { MockLanguageModelV3 } from 'ai/test';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../db/client.js';
import { DEMO } from '../db/demo-data.js';
import * as schema from '../db/schema.js';
import { seedDemo } from '../db/seed.js';
import { createTestDb } from '../db/test-db.js';
import { buildContextPack } from './context/build.js';
import { createAgentPort } from './port.js';
import { AgentRunError, runAgent } from './run.js';

let db: Db;
let pack: ContextPack;

beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
  pack = await buildContextPack(db, { clientId: DEMO.client.id, projectId: DEMO.project.id });
});

afterAll(async () => {
  await closeDb(db);
});

async function newRequest(text: string): Promise<string> {
  const [row] = await db
    .insert(schema.requests)
    .values({ clientId: DEMO.client.id, projectId: DEMO.project.id, channel: 'web', text })
    .returning();
  return row?.id ?? '';
}

function textModel(texts: string[]): MockLanguageModelV3 {
  let call = 0;
  return new MockLanguageModelV3({
    provider: 'test',
    modelId: 'scripted',
    doGenerate: async () => {
      const text = texts[Math.min(call, texts.length - 1)] ?? '';
      call += 1;
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

const VALID_OUTPUT = JSON.stringify({
  lineItems: [
    {
      kind: 'rule',
      ref: { id: 'S2.alert', version: 1 },
      quantity: 1,
      label: 'Daily sales drop alert (20%)',
      rationale: 'Alerts are excluded by clause C2 and priced with rule S2.alert.v1.',
    },
  ],
  needsInfo: [],
  explanation: 'One alert automation.',
  deliveryDays: 1,
  confidence: 0.9,
});

const OUTPUT_WITH_A_PRICE = JSON.stringify({
  lineItems: [
    {
      kind: 'rule',
      ref: { id: 'S2.alert', version: 1 },
      quantity: 1,
      amountCents: 6000,
      label: 'Daily sales drop alert (20%)',
      rationale: 'Alerts are excluded by clause C2 and priced with rule S2.alert.v1.',
    },
  ],
  needsInfo: [],
  explanation: 'One alert automation.',
  deliveryDays: 1,
  confidence: 0.9,
});

describe('createAgentPort with the mock provider', () => {
  const port = createAgentPort({ LLM_PROVIDER: 'mock' });

  test('demo request 1 yields included C1 and rule S2.report, and records an ok run', async () => {
    const text = 'I need a per-branch view and a summary email every Monday.';
    const requestId = await newRequest(text);

    const { output, runId } = await port.runAgent(
      { db },
      { pack, text, skill: 'analyze-additional', requestId },
    );

    expect(output.lineItems).toMatchObject([
      { kind: 'included', scopeRef: 'C1' },
      { kind: 'rule', ref: { id: 'S2.report', version: 1 } },
    ]);
    expect(output.needsInfo).toEqual([]);

    const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId));
    expect(run).toMatchObject({
      requestId,
      provider: 'mock',
      model: 'mock-fixtures',
      outcome: 'ok',
      error: null,
    });
    expect(run?.promptVersion).toMatch(/^([0-9a-f]{7,12}|dev)$/);
    expect(run?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('demo request 5 asks one question', async () => {
    const text = 'Make the dashboard load faster.';
    const requestId = await newRequest(text);
    const { output } = await port.runAgent(
      { db },
      { pack, text, skill: 'analyze-additional', requestId },
    );
    expect(output.lineItems).toEqual([]);
    expect(output.needsInfo).toHaveLength(1);
    expect(output.confidence).toBe(0.4);
  });

  test('answers to an open question are matched too', async () => {
    const text = 'Make the dashboard load faster.';
    const requestId = await newRequest(text);
    const { output } = await port.runAgent(
      { db },
      {
        pack,
        text,
        skill: 'analyze-additional',
        requestId,
        answers: { 'data volume or design': 'We want to add our Amazon sales as a second source.' },
      },
    );
    expect(output.lineItems.map((l) => (l.kind === 'rule' ? l.ref.id : l.scopeRef))).toEqual([
      'S3.base',
      'S3.per_source',
    ]);
  });

  test('a request no fixture covers ends as invalid_output', async () => {
    const text = 'Paint my office.';
    const requestId = await newRequest(text);
    await expect(
      port.runAgent({ db }, { pack, text, skill: 'analyze-additional', requestId }),
    ).rejects.toMatchObject({ code: 'invalid_output' });
    const runs = await db
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.requestId, requestId));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.outcome).toBe('invalid_output');
  });

  test('buildContextPack is the B1 function', async () => {
    const built = await port.buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });
    expect(built.project?.scopeClauses.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
  });
});

describe('runAgent with a scripted model', () => {
  test('an output carrying an amount is rejected, retried once, then recorded as invalid_output', async () => {
    const model = textModel([OUTPUT_WITH_A_PRICE]);
    const text = "Alert me by email when any branch's daily sales drop more than 20%.";
    const requestId = await newRequest(text);

    const promise = runAgent(
      { db, model, provider: 'test', modelName: 'scripted' },
      { pack, text, skill: 'analyze-additional', requestId },
    );
    await expect(promise).rejects.toBeInstanceOf(AgentRunError);
    await expect(promise).rejects.toMatchObject({ code: 'invalid_output', status: 422 });

    expect(model.doGenerateCalls).toHaveLength(2);
    const [run] = await db
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.requestId, requestId));
    expect(run).toMatchObject({
      outcome: 'invalid_output',
      provider: 'test',
      model: 'scripted',
      inputTokens: 200,
      outputTokens: 40,
    });
    expect(run?.error).toMatch(/amountCents/);
  });

  test('a schema failure followed by a valid answer is one ok run with both attempts counted', async () => {
    const model = textModel([OUTPUT_WITH_A_PRICE, VALID_OUTPUT]);
    const text = "Alert me by email when any branch's daily sales drop more than 20%.";
    const requestId = await newRequest(text);

    const { output, runId } = await runAgent(
      { db, model, provider: 'test', modelName: 'scripted' },
      { pack, text, skill: 'analyze-additional', requestId },
    );

    expect(output.lineItems[0]).toMatchObject({ kind: 'rule', ref: { id: 'S2.alert' } });
    expect(model.doGenerateCalls).toHaveLength(2);
    const retryPrompt = JSON.stringify(model.doGenerateCalls[1]?.prompt);
    expect(retryPrompt).toMatch(/did not match/i);
    const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId));
    expect(run).toMatchObject({ outcome: 'ok', inputTokens: 200, outputTokens: 40 });
  });

  test('the prompt carries the instructions, the skill, the rendered pack and the request', async () => {
    const model = textModel([VALID_OUTPUT]);
    const text = "Alert me by email when any branch's daily sales drop more than 20%.";
    const requestId = await newRequest(text);
    await runAgent(
      { db, model, provider: 'test', modelName: 'scripted' },
      { pack, text, skill: 'analyze-additional', requestId, answers: { q1: 'Data volume.' } },
    );
    const call = model.doGenerateCalls[0];
    const system = call?.prompt.find((m) => m.role === 'system');
    const user = call?.prompt.find((m) => m.role === 'user');
    const systemText = system?.role === 'system' ? system.content : '';
    const userText = JSON.stringify(user?.content ?? []);
    expect(systemText).toMatch(/never/i);
    expect(systemText).toMatch(/analyze/i);
    expect(userText).toContain('[C2] excluded');
    expect(userText).toContain('[S2.alert.v1]');
    expect(userText).toContain(text);
    expect(userText).toContain('Data volume.');
    expect(call?.responseFormat?.type).toBe('json');
  });

  test('a transport failure is recorded as error and rethrown', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error('socket hang up');
      },
    });
    const text = 'Send the Monday summary to our regional managers too.';
    const requestId = await newRequest(text);
    await expect(
      runAgent(
        { db, model, provider: 'test', modelName: 'broken' },
        { pack, text, skill: 'analyze-additional', requestId },
      ),
    ).rejects.toMatchObject({ code: 'agent_failed', status: 502 });
    const [run] = await db
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.requestId, requestId));
    expect(run).toMatchObject({ outcome: 'error', error: 'socket hang up' });
  });
});
