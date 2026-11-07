import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import { fundingHeadroomCents } from '../modules/mandates/mandates.js';
import { activateMandate, createHarness } from '../test/workflow-harness.js';
import { completeFunding, createMandate, revokeMandate } from './mandate-funding.js';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});
describe('mandate funding', () => {
  test('validates limits and refuses a duplicate mandate', async () => {
    const input = {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      perPurchaseLimitCents: 20000,
      totalLimitCents: 10000,
      expiresAt: '2026-12-31T00:00:00Z',
    };
    await expect(createMandate(h.deps, input)).rejects.toMatchObject({ code: 'invalid_mandate' });
    await expect(createMandate(h.deps, { ...input, totalLimitCents: 30000 })).rejects.toMatchObject(
      { code: 'mandate_exists', status: 409 },
    );
  });
  test('activates funding and supports revocation', async () => {
    const m = await activateMandate(h.deps);
    expect(m.status).toBe('active');
    expect(m.funding.paypalAuthorizationId).toBeTruthy();
    expect(fundingHeadroomCents(m)).toBe(200000);
    expect(h.events.filter((e) => e.type === 'mandate.updated')).toHaveLength(1);
    expect(await revokeMandate(h.deps, { mandateId: m.id })).toMatchObject({ status: 'revoked' });
  });
  test('refuses funding an unrelated mandate with an order', async () => {
    const order = await h.paypal.createOrder({
      intent: 'AUTHORIZE',
      amountCents: 200000,
      customId: 'mandate:other',
      requestId: 'other',
      returnUrl: 'http://localhost:3000',
      cancelUrl: 'http://localhost:3000',
    });
    await expect(
      completeFunding(h.deps, { mandateId: DEMO.mandate.id, orderId: order.orderId }),
    ).rejects.toMatchObject({ code: 'order_mismatch', status: 403 });
  });
});
