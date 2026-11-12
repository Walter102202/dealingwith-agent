import type { LineItemIntent } from '@dealingwith/contracts';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { issueAgentToken } from '../access/agent-tokens.js';
import { DEMO } from '../db/demo-data.js';
import { resetDemoData } from '../db/seed.js';
import { fundingHeadroomCents, getMandate, updateMandate } from '../modules/mandates/mandates.js';
import { activateMandate, createHarness, publishedQuote } from '../test/workflow-harness.js';
import { acceptQuote } from './accept-quote.js';
import {
  completeFunding,
  createMandate,
  revokeMandate,
  startFunding,
  updateMandateLimits,
} from './mandate-funding.js';

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
    expect(fundingHeadroomCents(m)).toBe(30000);
    expect(h.events.filter((e) => e.type === 'mandate.updated')).toHaveLength(1);
    expect(await revokeMandate(h.deps, { mandateId: m.id })).toMatchObject({ status: 'revoked' });
  });
  test('funds at most what the agent can still spend: the total minus spent', async () => {
    const fund = (fundingAmountCents: number) =>
      startFunding(h.deps, { mandateId: DEMO.mandate.id, fundingAmountCents });
    await expect(fund(30001)).rejects.toMatchObject({
      code: 'invalid_mandate',
      message: 'Funding cannot exceed what the agent can still spend, US$300.00',
    });
    await updateMandate(h.deps.db, DEMO.mandate.id, { status: 'active', spentCents: 10000 });
    await expect(fund(20001)).rejects.toMatchObject({ code: 'invalid_mandate' });
    await expect(fund(20000)).resolves.toMatchObject({ orderId: expect.any(String) });
    await expect(fund(0)).rejects.toMatchObject({ code: 'invalid_mandate' });
  });
  test.each(['exhausted', 'expired', 'revoked'] as const)(
    'refuses funding a %s mandate',
    async (status) => {
      await updateMandate(h.deps.db, DEMO.mandate.id, { status });
      await expect(
        startFunding(h.deps, { mandateId: DEMO.mandate.id, fundingAmountCents: 30000 }),
      ).rejects.toMatchObject({
        code: 'invalid_mandate',
        message: `A ${status} mandate cannot be funded`,
      });
    },
  );
  test('refuses funding a mandate whose expiry has passed', async () => {
    await updateMandate(h.deps.db, DEMO.mandate.id, {
      expiresAt: new Date('2026-11-07T11:59:59Z'),
    });
    await expect(
      startFunding(h.deps, { mandateId: DEMO.mandate.id, fundingAmountCents: 30000 }),
    ).rejects.toMatchObject({
      code: 'invalid_mandate',
      message: 'The mandate has expired; set a new expiry first',
    });
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
  test('after a reset the client assigns the budget: the agent pays within it, the authorization is the total', async () => {
    const rule = (id: string): LineItemIntent => ({
      kind: 'rule',
      ref: { id, version: 1 },
      quantity: 1,
      label: id,
      rationale: id,
    });
    const { agent } = await issueAgentToken(h.deps.db, {
      clientId: DEMO.client.id,
      label: "Mara's assistant",
      mandateId: DEMO.mandate.id,
    });
    const accept = async (intents: LineItemIntent[]) => {
      const q = await publishedQuote(h.deps, { intents, channel: 'mcp' });
      return acceptQuote(h.deps, { quoteId: q.id, version: 1, actor: { kind: 'agent', agent } });
    };

    await activateMandate(h.deps);
    await resetDemoData(h.deps.db);
    // A later run: the funding PayPal-Request-Id carries the time, and the harness clock is fixed.
    h.deps.now = () => new Date('2026-11-07T12:05:00Z');
    const reset = await getMandate(h.deps.db, DEMO.mandate.id);
    expect(reset).toMatchObject({ status: 'pending', funding: { fundingAmountCents: 0 } });
    expect(reset.funding.paypalAuthorizationId).toBeUndefined();
    expect(await accept([rule('S2.alert')])).toMatchObject({
      status: 'approval_required',
      reason: 'mandate_inactive',
      approvalUrl: expect.any(String),
    });

    // The assign form saves edited limits on the pending mandate, then authorizes the total.
    const edited = await updateMandateLimits(h.deps, {
      mandateId: DEMO.mandate.id,
      perPurchaseLimitCents: 10000,
      totalLimitCents: 25000,
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    expect(edited).toMatchObject({ status: 'pending', totalLimitCents: 25000 });
    const order = await startFunding(h.deps, {
      mandateId: DEMO.mandate.id,
      fundingAmountCents: edited.totalLimitCents,
    });
    await h.paypal.approve(order.orderId);
    const funded = await completeFunding(h.deps, {
      mandateId: DEMO.mandate.id,
      orderId: order.orderId,
    });
    expect(funded).toMatchObject({
      status: 'active',
      funding: { fundingAmountCents: 25000, fundingCapturedCents: 0 },
    });

    expect(await accept([rule('S2.alert')])).toMatchObject({
      status: 'paid',
      payment: { mode: 'mandate', status: 'captured', amountCents: 6000 },
    });
    expect(await accept([rule('S3.base'), rule('S3.per_source')])).toMatchObject({
      status: 'approval_required',
      reason: 'over_per_purchase',
    });
    expect(await getMandate(h.deps.db, DEMO.mandate.id)).toMatchObject({
      spentCents: 6000,
      funding: { fundingAmountCents: 25000, fundingCapturedCents: 6000 },
    });
  });
});
