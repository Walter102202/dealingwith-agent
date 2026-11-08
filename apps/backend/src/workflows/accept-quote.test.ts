import { randomUUID } from 'node:crypto';
import type { ClientAgent, LineItemIntent } from '@dealingwith/contracts';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import { payments } from '../db/schema.js';
import { getMandate, updateMandate } from '../modules/mandates/mandates.js';
import { getProject } from '../modules/projects/projects.js';
import { createQuoteVersion, getQuote, updateQuoteStatus } from '../modules/quotes/quotes.js';
import { activateMandate, createHarness, publishedQuote } from '../test/workflow-harness.js';
import { acceptQuote } from './accept-quote.js';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});
const intent = (id = 'S2.report'): LineItemIntent => ({
  kind: 'rule',
  ref: { id, version: 1 },
  quantity: 1,
  label: id,
  rationale: id,
});
const agent = (): ClientAgent => ({
  id: randomUUID(),
  clientId: DEMO.client.id,
  label: 'Agent',
  scopes: ['quote:request', 'quote:accept'],
  createdAt: new Date(0).toISOString(),
});
describe('acceptQuote', () => {
  test('web acceptance and concurrent repeats reuse one payment and approval URL', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const input = {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web' as const, clientId: DEMO.client.id },
    };
    const [a, b] = await Promise.all([acceptQuote(h.deps, input), acceptQuote(h.deps, input)]);
    expect(a.status).toBe('approval_required');
    expect(a.approvalUrl).toContain('/mock-paypal/approve/');
    expect(b.payment?.id).toBe(a.payment?.id);
    expect(b.approvalUrl).toBe(a.approvalUrl);
    expect(a.payment?.status).toBe('created');
    expect(await h.deps.db.select().from(payments)).toMatchObject([
      { idempotencyKey: `pay:${q.id}:1` },
    ]);
    expect(await getQuote(h.deps.db, q.id)).toMatchObject({ status: 'accepted' });
    expect(h.events.some((e) => e.type === 'payment.approval_required')).toBe(true);
  });
  test('denies stale, needs-info and foreign acceptance without payment', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    await createQuoteVersion(h.deps.db, {
      requestId: q.requestId,
      quoteId: q.id,
      projectId: DEMO.project.id,
      priced: q,
      agentOutput: {
        lineItems: [],
        needsInfo: [],
        explanation: '',
        deliveryDays: 1,
        confidence: 1,
      },
      status: 'published',
    });
    const actor = { kind: 'web' as const, clientId: DEMO.client.id };
    expect(await acceptQuote(h.deps, { quoteId: q.id, version: 1, actor })).toMatchObject({
      status: 'denied',
      reason: 'stale_version',
      message: expect.stringContaining('version is 2'),
    });
    await updateQuoteStatus(h.deps.db, { quoteId: q.id, version: 2, status: 'needs_info' });
    expect(await acceptQuote(h.deps, { quoteId: q.id, version: 2, actor })).toMatchObject({
      reason: 'not_acceptable',
    });
    await expect(
      acceptQuote(h.deps, {
        quoteId: q.id,
        version: 2,
        actor: { kind: 'web', clientId: randomUUID() },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await h.deps.db.select().from(payments)).toHaveLength(0);
  });
  test('agent capture reserves once and adds scope once under concurrent acceptance', async () => {
    await activateMandate(h.deps);
    const q = await publishedQuote(h.deps, { intents: [intent('S2.alert')] });
    const input = { quoteId: q.id, version: 1, actor: { kind: 'agent' as const, agent: agent() } };
    const results = await Promise.all([acceptQuote(h.deps, input), acceptQuote(h.deps, input)]);
    expect(results.map((r) => r.status)).toEqual(['paid', 'paid']);
    expect(results[0]?.payment).toMatchObject({ mode: 'mandate', status: 'captured' });
    expect(await getMandate(h.deps.db, DEMO.mandate.id)).toMatchObject({
      spentCents: 6000,
      funding: { fundingCapturedCents: 6000 },
    });
    expect((await getProject(h.deps.db, DEMO.project.id)).scopeClauses).toHaveLength(4);
    expect(h.events.filter((e) => e.type === 'quote.paid')).toHaveLength(1);
  });
  test('returns human approval for 19000 cents without spending mandate budget', async () => {
    await activateMandate(h.deps);
    const q = await publishedQuote(h.deps, {
      intents: [intent('S3.base'), intent('S3.per_source')],
    });
    expect(
      await acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent', agent: agent() },
      }),
    ).toMatchObject({
      status: 'approval_required',
      reason: 'over_per_purchase',
      message:
        'US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal.',
      approvalUrl: expect.any(String),
    });
    expect((await getMandate(h.deps.db, DEMO.mandate.id)).spentCents).toBe(0);
  });
  test('denies a pending mandate and offers human approval without a mandate', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const input = { quoteId: q.id, version: 1, actor: { kind: 'agent' as const, agent: agent() } };
    expect(await acceptQuote(h.deps, input)).toMatchObject({
      reason: 'mandate_inactive',
      status: 'denied',
    });
    await updateMandate(h.deps.db, DEMO.mandate.id, { status: 'revoked' });
    expect(await acceptQuote(h.deps, input)).toMatchObject({
      reason: 'no_mandate',
      status: 'approval_required',
    });
  });
  test('releases reservation when PayPal funding is exhausted', async () => {
    await activateMandate(h.deps, 2000);
    await updateMandate(h.deps.db, DEMO.mandate.id, { fundingAmountCents: 200000 });
    const q = await publishedQuote(h.deps, { intents: [intent('S2.alert')] });
    expect(
      await acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent', agent: agent() },
      }),
    ).toMatchObject({ reason: 'funding_exhausted', status: 'denied' });
    expect((await getMandate(h.deps.db, DEMO.mandate.id)).spentCents).toBe(0);
  });
  test('marks an included quote paid without creating a payment', async () => {
    const q = await publishedQuote(h.deps, {
      intents: [{ kind: 'included', scopeRef: 'C1', label: 'View', rationale: 'C1' }],
    });
    expect(
      await acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'web', clientId: DEMO.client.id },
      }),
    ).toEqual({
      status: 'paid',
      message: 'Nothing to pay: everything requested is already included in the project scope.',
    });
    expect(await h.deps.db.select().from(payments)).toHaveLength(0);
  });
});
