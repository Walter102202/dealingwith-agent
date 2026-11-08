import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import { payments, webhookEvents } from '../db/schema.js';
import { getMandate } from '../modules/mandates/mandates.js';
import { getQuote } from '../modules/quotes/quotes.js';
import { activateMandate, createHarness, publishedQuote } from '../test/workflow-harness.js';
import { acceptQuote } from './accept-quote.js';
import { processWebhook } from './webhooks.js';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});
const body = (id: string, resource: object, event_type = 'PAYMENT.CAPTURE.COMPLETED') =>
  JSON.stringify({ id, event_type, resource });
describe('processWebhook', () => {
  test('rejects a capture whose amount or currency differs and rolls back its event', async () => {
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
    for (const amount of [
      { currency_code: 'USD', value: '0.01' },
      { currency_code: 'EUR', value: '80.00' },
    ]) {
      await expect(
        processWebhook(h.deps, {
          headers: { 'x-mock-signature': h.deps.env.MOCK_WEBHOOK_SECRET },
          rawBody: body('WH-invalid-amount', {
            id: 'CAP-bad',
            amount,
            supplementary_data: { related_ids: { order_id: accepted.payment?.paypalOrderId } },
          }),
        }),
      ).rejects.toMatchObject({ code: 'payment_mismatch' });
    }
    expect(await h.deps.db.select().from(webhookEvents)).toHaveLength(0);
    expect(await getQuote(h.deps.db, q.id)).toMatchObject({ status: 'accepted' });
  });
  test('rejects invalid signatures without storing an event and records unknown orders as ignored', async () => {
    const rawBody = body('WH-test', {
      id: 'CAP-unknown',
      supplementary_data: { related_ids: { order_id: 'unknown' } },
    });
    expect(await processWebhook(h.deps, { headers: {}, rawBody })).toEqual({
      result: 'invalid_signature',
    });
    expect(await h.deps.db.select().from(webhookEvents)).toHaveLength(0);
    expect(
      await processWebhook(h.deps, {
        headers: { 'x-mock-signature': h.deps.env.MOCK_WEBHOOK_SECRET },
        rawBody,
      }),
    ).toEqual({ result: 'ignored' });
    expect(await h.deps.db.select().from(webhookEvents)).toMatchObject([{ result: 'ignored' }]);
    expect(await h.deps.db.select().from(payments)).toHaveLength(0);
  });
  test('processes approved and completed events once, including concurrent retries', async () => {
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
    await h.paypal.approve(a.payment?.paypalOrderId ?? '');
    expect(await h.deps.db.select().from(payments)).toMatchObject([{ status: 'approved' }]);
    const rawBody = body('WH-complete', {
      id: 'CAP-1',
      amount: { currency_code: 'USD', value: '80.00' },
      supplementary_data: { related_ids: { order_id: a.payment?.paypalOrderId } },
    });
    const input = { headers: { 'x-mock-signature': h.deps.env.MOCK_WEBHOOK_SECRET }, rawBody };
    const results = await Promise.all([
      processWebhook(h.deps, input),
      processWebhook(h.deps, input),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual(['duplicate', 'processed']);
    expect(await getQuote(h.deps.db, q.id)).toMatchObject({ status: 'paid' });
  });
  test('revokes an active mandate when its authorization is voided', async () => {
    const m = await activateMandate(h.deps);
    await processWebhook(h.deps, {
      headers: { 'x-mock-signature': h.deps.env.MOCK_WEBHOOK_SECRET },
      rawBody: body(
        'WH-void',
        { id: m.funding.paypalAuthorizationId },
        'PAYMENT.AUTHORIZATION.VOIDED',
      ),
    });
    expect(await getMandate(h.deps.db, m.id)).toMatchObject({ status: 'revoked' });
  });
});
