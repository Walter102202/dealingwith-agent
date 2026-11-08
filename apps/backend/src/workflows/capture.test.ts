import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { signSession } from '../access/session.js';
import { createApp } from '../api/app.js';
import { DEMO } from '../db/demo-data.js';
import { payments } from '../db/schema.js';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { getProject } from '../modules/projects/projects.js';
import { createHarness, publishedQuote } from '../test/workflow-harness.js';
import { acceptQuote } from './accept-quote.js';
import { captureApprovedOrder } from './capture.js';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});
describe('captureApprovedOrder', () => {
  test('captures by order capability without a cookie, reuses capture, and still checks a present session', async () => {
    const q = await publishedQuote(h.deps, {
      intents: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Summary',
          rationale: 'S2.report',
        },
      ],
    });
    const accepted = await acceptQuote(h.deps, {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web', clientId: DEMO.client.id },
    });
    const orderId = accepted.payment?.paypalOrderId ?? '';
    const delivery = vi.spyOn(h.paypal, 'emitWebhook').mockResolvedValueOnce();
    await h.paypal.approve(orderId);
    delivery.mockRestore();
    const capture = vi.spyOn(h.paypal, 'captureOrder');
    const app = createApp(h.deps);
    const path = `/api/paypal/orders/${orderId}/capture`;
    const cookie = `dw_session=${signSession({ role: 'client', clientId: randomUUID(), businessId: DEMO.business.id, name: 'Other' }, h.deps.env.SESSION_SECRET, { now: h.deps.now() })}`;
    expect((await app.request(path, { method: 'POST', headers: { cookie } })).status).toBe(403);
    const first = await app.request(path, { method: 'POST' });
    expect(first.status).toBe(200);
    const payment = await first.json();
    expect(payment).toMatchObject({ status: 'captured' });
    const repeat = await app.request(path, { method: 'POST' });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual(payment);
    expect(capture).toHaveBeenCalledTimes(1);
  });
  test('rejects unapproved orders and captures once despite concurrent calls and webhook delivery', async () => {
    const q = await publishedQuote(h.deps, {
      intents: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Summary',
          rationale: 'S2.report',
        },
      ],
    });
    const accepted = await acceptQuote(h.deps, {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web', clientId: DEMO.client.id },
    });
    const orderId = accepted.payment?.paypalOrderId ?? '';
    await expect(captureApprovedOrder(h.deps, { orderId })).rejects.toMatchObject({
      code: 'order_not_approved',
      status: 409,
    });
    await h.paypal.approve(orderId);
    const [a, b] = await Promise.all([
      captureApprovedOrder(h.deps, { orderId }),
      captureApprovedOrder(h.deps, { orderId }),
    ]);
    expect(a).toMatchObject({ status: 'captured', paypalCaptureId: expect.any(String) });
    expect(b.id).toBe(a.id);
    expect(await h.deps.db.select().from(payments)).toHaveLength(1);
    expect((await getProject(h.deps.db, DEMO.project.id)).scopeClauses).toHaveLength(4);
    expect(h.events.filter((e) => e.type === 'quote.paid')).toHaveLength(1);
  });
  test('recovers a capture already completed at PayPal', async () => {
    const q = await publishedQuote(h.deps, {
      intents: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Summary',
          rationale: 'S2.report',
        },
      ],
    });
    const a = await acceptQuote(h.deps, {
      quoteId: q.id,
      version: 1,
      actor: { kind: 'web', clientId: DEMO.client.id },
    });
    const orderId = a.payment?.paypalOrderId ?? '';
    vi.spyOn(h.paypal, 'captureOrder').mockRejectedValue(new PaypalError('ORDER_ALREADY_CAPTURED'));
    vi.spyOn(h.paypal, 'getOrder').mockResolvedValue({
      orderId,
      intent: 'CAPTURE',
      status: 'COMPLETED',
      amountCents: 8000,
      customId: `quote:${q.id}:1`,
      captureId: 'CAP-RECOVERED',
      raw: {},
    });
    expect(await captureApprovedOrder(h.deps, { orderId })).toMatchObject({
      status: 'captured',
      paypalCaptureId: 'CAP-RECOVERED',
    });
  });
});
