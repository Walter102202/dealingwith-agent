import { AcceptQuoteResultSchema, ProjectViewSchema, QuoteSchema } from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { payments } from '../../apps/backend/src/db/schema.js';
import { createScenario, post } from './helpers.js';

test('Already included: a purchased additional costs US$0 and creates no new payment', async () => {
  const s = await createScenario();
  try {
    const path = `/api/projects/${DEMO.project.id}`;
    const quote = QuoteSchema.parse(
      await (
        await s.request(
          `${path}/requests`,
          post({ text: 'I need a per-branch view and a summary email every Monday.' }),
        )
      ).json(),
    );
    const accepted = AcceptQuoteResultSchema.parse(
      await (await s.request(`/api/quotes/${quote.id}/accept`, post({ version: 1 }))).json(),
    );
    const orderId = accepted.payment?.paypalOrderId ?? '';
    await s.paypal.approve(orderId);
    await s.request(`/api/paypal/orders/${orderId}/capture`, post({}));
    const included = QuoteSchema.parse(
      await (
        await s.request(
          `${path}/requests`,
          post({ text: 'Send the Monday summary to our regional managers too.' }),
        )
      ).json(),
    );
    expect(included.totalCents).toBe(0);
    expect(included.lineItems).toMatchObject([
      { kind: 'included', scopeRef: 'C4', amountCents: 0 },
    ]);
    expect(
      await (await s.request(`/api/quotes/${included.id}/accept`, post({ version: 1 }))).json(),
    ).toMatchObject({ status: 'paid' });
    expect(await s.deps.db.select().from(payments)).toHaveLength(1);
    expect(
      ProjectViewSchema.parse(await (await s.request(path)).json()).project.scopeClauses,
    ).toHaveLength(4);
  } finally {
    await s.close();
  }
});
