import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import { agentRuns, quotes, requests } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { PricingError } from '../modules/quotes/errors.js';
import { getRequest } from '../modules/requests/requests.js';
import { createHarness, publishedQuote } from '../test/workflow-harness.js';
import { fakeAgentPort } from './fake-agent.js';
import { submitRequest } from './submit-request.js';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(async () => {
  h = await createHarness({ agent: fakeAgentPort() });
});
afterEach(async () => {
  await h.close();
});
describe('submitRequest', () => {
  test('answers on a quote that is not awaiting information are rejected and nothing changes', async () => {
    const published = await publishedQuote(h.deps, {
      intents: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Weekly email',
          rationale: 'Rule S2.report',
        },
      ],
    });
    const attempt = submitRequest(h.deps, {
      quoteId: published.id,
      answers: { anything: 'yes' },
      clientId: DEMO.client.id,
      channel: 'web',
    });
    await expect(attempt).rejects.toMatchObject({
      code: 'quote_not_awaiting_answers',
      status: 409,
    });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    const rows = await h.deps.db.select().from(quotes).where(eq(quotes.quoteId, published.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('published');
  });
  test('prices the Monday request and records its run and published event', async () => {
    const q = await submitRequest(h.deps, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'web',
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    expect(q).toMatchObject({ status: 'published', totalCents: 8000 });
    expect(q.lineItems).toHaveLength(2);
    expect(await getRequest(h.deps.db, q.requestId)).toMatchObject({ status: 'quoted' });
    expect(await h.deps.db.select().from(agentRuns)).toHaveLength(1);
    expect(h.events.map((e) => e.type)).toEqual(['quote.published']);
  });
  test('asks for information and uses answers to create version two', async () => {
    const q = await submitRequest(h.deps, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'web',
      text: 'Make the dashboard load faster.',
    });
    expect(q.status).toBe('needs_info');
    expect(await getRequest(h.deps.db, q.requestId)).toMatchObject({ status: 'needs_info' });
    expect(h.events[0]?.type).toBe('quote.needs_info');
    const next = await submitRequest(h.deps, {
      quoteId: q.id,
      clientId: DEMO.client.id,
      channel: 'web',
      answers: { clarification: 'Amazon sales as a second source' },
    });
    expect(next).toMatchObject({ id: q.id, version: 2, totalCents: 19000 });
  });
  test('fails requests whose agent output references an unknown rule', async () => {
    h.deps.agent = fakeAgentPort({
      invalid: {
        lineItems: [
          {
            kind: 'rule',
            ref: { id: 'S9.nope', version: 1 },
            quantity: 1,
            label: 'Invalid',
            rationale: 'Invalid',
          },
        ],
        needsInfo: [],
        explanation: '',
        deliveryDays: 1,
        confidence: 1,
      },
    });
    await expect(
      submitRequest(h.deps, { clientId: DEMO.client.id, channel: 'web', text: 'invalid' }),
    ).rejects.toBeInstanceOf(PricingError);
    expect(
      await h.deps.db.select().from(requests).where(eq(requests.status, 'failed')),
    ).toHaveLength(1);
  });
});
