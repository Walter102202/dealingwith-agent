import { randomUUID } from 'node:crypto';
import { QuoteSchema } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { signSession } from '../access/session.js';
import { createApp } from '../api/app.js';
import { DEMO } from '../db/demo-data.js';
import { agentRuns, businesses, quotes, requests, services } from '../db/schema.js';
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
  test.each(['/api/requests', `/api/projects/${DEMO.project.id}/requests`])(
    'buys S1 deterministically through %s with no agent run',
    async (path) => {
      const run = vi.spyOn(h.deps.agent, 'runAgent');
      const build = vi.spyOn(h.deps.agent, 'buildContextPack');
      const cookie = `dw_session=${signSession({ role: 'client', clientId: DEMO.client.id, businessId: DEMO.business.id, name: 'Mara' }, h.deps.env.SESSION_SECRET, { now: h.deps.now() })}`;
      const response = await createApp(h.deps).request(path, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: 'Buy Analytics dashboard build',
          serviceId: DEMO.services.S1.id,
        }),
      });
      expect(response.status).toBe(200);
      const q = QuoteSchema.parse(await response.json());
      expect(q).toMatchObject({
        status: 'published',
        totalCents: 120000,
        deliveryDays: 15,
        explanation: 'Fixed price for Analytics dashboard build.',
      });
      expect(q.lineItems).toMatchObject([
        { kind: 'rule', quantity: 1, ruleRef: { id: 'S1.price', version: 1 } },
      ]);
      expect(run).not.toHaveBeenCalled();
      expect(build).not.toHaveBeenCalled();
      expect(await h.deps.db.select().from(agentRuns)).toHaveLength(0);
    },
  );
  test('rejects another business service before persisting any request', async () => {
    const businessId = randomUUID();
    const serviceId = randomUUID();
    await h.deps.db.insert(businesses).values({ id: businessId, name: 'Other', country: 'US' });
    await h.deps.db.insert(services).values({
      id: serviceId,
      businessId,
      name: 'Other service',
      pricingRules: [
        { id: 'other.price', version: 1, type: 'fixed', label: 'Other', amountCents: 100 },
      ],
    });
    await expect(
      submitRequest(h.deps, { clientId: DEMO.client.id, channel: 'mcp', text: 'Buy', serviceId }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
      message: 'Service belongs to another business',
    });
    expect(await h.deps.db.select().from(requests)).toHaveLength(0);
  });
  test('uses the agent when the selected service has multiple fixed rules', async () => {
    const run = vi.spyOn(h.deps.agent, 'runAgent');
    const q = await submitRequest(h.deps, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'web',
      serviceId: DEMO.services.S2.id,
      text: 'summary email every Monday',
    });
    expect(q.totalCents).toBe(8000);
    expect(run).toHaveBeenCalledTimes(1);
  });
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
