import {
  AcceptQuoteResultSchema,
  PaymentSchema,
  ProjectViewSchema,
  QuoteSchema,
} from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { payments, webhookEvents } from '../../apps/backend/src/db/schema.js';
import { createScenario, post } from './helpers.js';

test('Duplicate webhook or duplicate accept: one payment, one additional, repeats are no-ops', async () => {
  const s = await createScenario();
  try {
    const path = `/api/projects/${DEMO.project.id}`;
    const q = QuoteSchema.parse(
      await (
        await s.request(`${path}/requests`, post({ text: 'summary email every Monday' }))
      ).json(),
    );
    const accept = async () =>
      AcceptQuoteResultSchema.parse(
        await (await s.request(`/api/quotes/${q.id}/accept`, post({ version: 1 }))).json(),
      );
    const a = await accept();
    const b = await accept();
    expect(b.payment?.id).toBe(a.payment?.id);
    expect(b.payment?.paypalOrderId).toBe(a.payment?.paypalOrderId);
    const orderId = a.payment?.paypalOrderId ?? '';
    await s.paypal.approve(orderId);
    const capture = async () =>
      PaymentSchema.parse(
        await (await s.request(`/api/paypal/orders/${orderId}/capture`, post({}))).json(),
      );
    const first = await capture();
    const second = await capture();
    expect(second).toEqual(first);
    expect(second.status).toBe('captured');
    const event = s.paypal.events().find((e) => e.event_type === 'PAYMENT.CAPTURE.COMPLETED');
    expect(event).toBeDefined();
    const retry = post(event);
    retry.headers = { ...retry.headers, 'x-mock-signature': s.deps.env.MOCK_WEBHOOK_SECRET };
    expect(await (await s.request('/api/webhooks/paypal', retry)).json()).toEqual({
      result: 'duplicate',
    });
    expect(await s.deps.db.select().from(payments)).toHaveLength(1);
    expect(
      ProjectViewSchema.parse(await (await s.request(path)).json()).project.scopeClauses.filter(
        (c) => c.id === 'C4',
      ),
    ).toHaveLength(1);
    const rows = await s.deps.db.select().from(webhookEvents);
    expect(rows.length).toBe(new Set(rows.map((r) => r.paypalEventId)).size);
  } finally {
    await s.close();
  }
});
