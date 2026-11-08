import { AcceptQuoteResultSchema, ProjectViewSchema, QuoteSchema } from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { createScenario, post } from './helpers.js';

test('Payment pending: acceptance does not mark the quote paid or change project scope', async () => {
  const s = await createScenario();
  try {
    const path = `/api/projects/${DEMO.project.id}`;
    const q = QuoteSchema.parse(
      await (
        await s.request(`${path}/requests`, post({ text: 'summary email every Monday' }))
      ).json(),
    );
    const accepted = AcceptQuoteResultSchema.parse(
      await (await s.request(`/api/quotes/${q.id}/accept`, post({ version: 1 }))).json(),
    );
    expect(accepted.status).toBe('approval_required');
    const view = ProjectViewSchema.parse(await (await s.request(path)).json());
    expect(view.quotes[0]?.status).toBe('accepted');
    expect(view.payments[0]?.status).toBe('created');
    expect(view.project.scopeClauses).toHaveLength(3);
    expect(
      (await s.request(`/mock-paypal/approve/${accepted.payment?.paypalOrderId}`)).status,
    ).toBe(200);
  } finally {
    await s.close();
  }
});
