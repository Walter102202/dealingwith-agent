import { randomUUID } from 'node:crypto';
import type { ClientAgent, LineItemIntent } from '@dealingwith/contracts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { issueAgentToken } from '../access/agent-tokens.js';
import { DEMO } from '../db/demo-data.js';
import { payments } from '../db/schema.js';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { getMandate, updateMandate } from '../modules/mandates/mandates.js';
import { getProject } from '../modules/projects/projects.js';
import { createQuoteVersion, getQuote, updateQuoteStatus } from '../modules/quotes/quotes.js';
import { activateMandate, createHarness, publishedQuote } from '../test/workflow-harness.js';
import { acceptQuote } from './accept-quote.js';
import { captureApprovedOrder } from './capture.js';

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
const agent = async (): Promise<ClientAgent> =>
  (await issueAgentToken(h.deps.db, { clientId: DEMO.client.id, label: 'Agent' })).agent;
describe('acceptQuote', () => {
  test('renews an expired order once and the new approval URL pays the quote', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const input = {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web' as const, clientId: DEMO.client.id },
    };
    const first = await acceptQuote(h.deps, input);
    expect(first.payment?.agentId).toBeUndefined();
    const oldId = first.payment?.paypalOrderId ?? '';
    h.paypal.expireOrder(oldId);
    const [renewed, repeated] = await Promise.all([
      acceptQuote(h.deps, input),
      acceptQuote(h.deps, input),
    ]);
    expect(renewed.payment?.id).toBe(first.payment?.id);
    expect(renewed.payment?.paypalOrderId).not.toBe(oldId);
    expect(repeated.approvalUrl).toBe(renewed.approvalUrl);
    expect(renewed.approvalUrl).toContain(renewed.payment?.paypalOrderId);
    expect(await h.deps.db.select().from(payments)).toMatchObject([{ raw: { orderAttempts: 2 } }]);
    await h.paypal.approve(renewed.payment?.paypalOrderId ?? '');
    expect((await getQuote(h.deps.db, q.id)).status).toBe('paid');
  });
  test('reconciles an order PayPal already captured instead of renewing it', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const input = {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web' as const, clientId: DEMO.client.id },
    };
    const first = await acceptQuote(h.deps, input);
    const orderId = first.payment?.paypalOrderId ?? '';
    const live = await h.paypal.getOrder(orderId);
    vi.spyOn(h.paypal, 'getOrder').mockResolvedValue({
      ...live,
      status: 'COMPLETED',
      captureId: 'MOCK-CAP-EXTERNAL',
    });
    const create = vi.spyOn(h.paypal, 'createOrder');
    const again = await acceptQuote(h.deps, input);
    expect(again.status).toBe('paid');
    expect(again.payment).toMatchObject({
      id: first.payment?.id,
      status: 'captured',
      paypalCaptureId: 'MOCK-CAP-EXTERNAL',
    });
    expect(create).not.toHaveBeenCalled();
    expect(await h.deps.db.select().from(payments)).toHaveLength(1);
    expect((await getQuote(h.deps.db, q.id)).status).toBe('paid');
  });
  test('refuses to capture an order whose quote was already paid another way', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const first = await acceptQuote(h.deps, {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web' as const, clientId: DEMO.client.id },
    });
    const orderId = first.payment?.paypalOrderId ?? '';
    await updateQuoteStatus(h.deps.db, { quoteId: q.id, version: 1, status: 'paid' });
    const capture = vi.spyOn(h.paypal, 'captureOrder');
    await expect(captureApprovedOrder(h.deps, { orderId })).rejects.toMatchObject({
      code: 'quote_already_paid',
      status: 409,
    });
    expect(capture).not.toHaveBeenCalled();
  });
  test.each(['ORDER_EXPIRED', 'RESOURCE_NOT_FOUND'])(
    'renews when getOrder returns %s',
    async (code) => {
      const q = await publishedQuote(h.deps, { intents: [intent()] });
      const input = {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'web' as const, clientId: DEMO.client.id },
      };
      const first = await acceptQuote(h.deps, input);
      vi.spyOn(h.paypal, 'getOrder').mockRejectedValueOnce(new PaypalError(code, 404));
      const next = await acceptQuote(h.deps, input);
      expect(next.payment?.paypalOrderId).not.toBe(first.payment?.paypalOrderId);
      expect(next.status).toBe('approval_required');
    },
  );
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
    const payer = await agent();
    const input = { quoteId: q.id, version: 1, actor: { kind: 'agent' as const, agent: payer } };
    const results = await Promise.all([acceptQuote(h.deps, input), acceptQuote(h.deps, input)]);
    expect(results.map((r) => r.status)).toEqual(['paid', 'paid']);
    expect(results[0]?.payment).toMatchObject({
      mode: 'mandate',
      status: 'captured',
      agentId: payer.id,
    });
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
    const overLimit = await agent();
    expect(
      await acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent', agent: overLimit },
      }),
    ).toMatchObject({
      status: 'approval_required',
      payment: { mode: 'pay_now', agentId: overLimit.id },
      reason: 'over_per_purchase',
      message:
        'US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal.',
      approvalUrl: expect.any(String),
    });
    expect((await getMandate(h.deps.db, DEMO.mandate.id)).spentCents).toBe(0);
  });
  test('offers human approval for a pending mandate and without a mandate', async () => {
    const q = await publishedQuote(h.deps, { intents: [intent()] });
    const input = {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'agent' as const, agent: await agent() },
    };
    expect(await acceptQuote(h.deps, input)).toMatchObject({
      reason: 'mandate_inactive',
      status: 'approval_required',
      approvalUrl: expect.any(String),
    });
    await updateMandate(h.deps.db, DEMO.mandate.id, { status: 'revoked' });
    const other = await publishedQuote(h.deps, { intents: [intent()] });
    expect(await acceptQuote(h.deps, { ...input, quoteId: other.id })).toMatchObject({
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
        actor: { kind: 'agent', agent: await agent() },
      }),
    ).toMatchObject({
      reason: 'funding_exhausted',
      status: 'approval_required',
      approvalUrl: expect.any(String),
    });
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
  test.each(['INSTRUMENT_DECLINED', 'AUTHORIZATION_AMOUNT_EXCEEDED'])(
    'falls back to one human order after the definitive decline %s, releasing the reservation once',
    async (code) => {
      await activateMandate(h.deps);
      const q = await publishedQuote(h.deps, { intents: [intent('S2.alert')] });
      vi.spyOn(h.paypal, 'captureAuthorization').mockRejectedValue(new PaypalError(code, 422));
      const input = {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent' as const, agent: await agent() },
      };
      const result = await acceptQuote(h.deps, input);
      expect(result).toMatchObject({
        status: 'approval_required',
        reason: 'funding_exhausted',
        approvalUrl: expect.any(String),
        payment: { mode: 'pay_now' },
      });
      expect((await acceptQuote(h.deps, input)).payment?.id).toBe(result.payment?.id);
      expect(await getMandate(h.deps.db, DEMO.mandate.id)).toMatchObject({
        spentCents: 0,
        funding: { fundingCapturedCents: 0 },
      });
      expect(
        (await h.deps.db.select().from(payments)).map((p) => [p.mode, p.status]).sort(),
      ).toEqual([
        ['mandate', 'denied'],
        ['pay_now', 'created'],
      ]);
    },
  );
  test.each([
    ['PAYPAL_UNAVAILABLE', 502],
    ['INTERNAL_SERVICE_ERROR', 500],
  ])(
    'keeps the mandate payment and its reservation after the ambiguous PayPal error %s',
    async (code, status) => {
      await activateMandate(h.deps);
      const q = await publishedQuote(h.deps, { intents: [intent('S2.alert')] });
      vi.spyOn(h.paypal, 'captureAuthorization').mockRejectedValue(new PaypalError(code, status));
      const input = {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent' as const, agent: await agent() },
      };
      await expect(acceptQuote(h.deps, input)).rejects.toMatchObject({ code, status });
      expect(await getMandate(h.deps.db, DEMO.mandate.id)).toMatchObject({ spentCents: 6000 });
      expect((await h.deps.db.select().from(payments)).map((p) => [p.mode, p.status])).toEqual([
        ['mandate', 'created'],
      ]);
    },
  );
  test('a pending authorization capture is ambiguous: nothing is released or denied', async () => {
    await activateMandate(h.deps);
    const q = await publishedQuote(h.deps, { intents: [intent('S2.alert')] });
    const live = h.paypal.captureAuthorization.bind(h.paypal);
    vi.spyOn(h.paypal, 'captureAuthorization').mockImplementation(async (id, i) => ({
      ...(await live(id, i)),
      status: 'PENDING',
    }));
    await expect(
      acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'agent', agent: await agent() },
      }),
    ).rejects.toMatchObject({ code: 'CAPTURE_NOT_COMPLETED', status: 502 });
    // The reservation stays and no human order is opened. The mock's completed-capture webhook
    // may already have reconciled the mandate payment by invoice id, which is the real-world path.
    expect(await getMandate(h.deps.db, DEMO.mandate.id)).toMatchObject({ spentCents: 6000 });
    const rows = await h.deps.db.select().from(payments);
    expect(rows.map((p) => p.mode)).toEqual(['mandate']);
    expect(['created', 'captured']).toContain(rows[0]?.status);
  });
});
