import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import { now } from '../../test/policy.js';
import { getMandate, updateMandate } from '../mandates/mandates.js';
import { createQuoteVersion } from '../quotes/quotes.js';
import { createRequest } from '../requests/requests.js';
import { releaseSpend, reserveSpend } from './reserve.js';

let db: Db;
let input: Parameters<typeof reserveSpend>[1];
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
  const request = await createRequest(db, {
    clientId: DEMO.client.id,
    projectId: DEMO.project.id,
    channel: 'mcp',
    text: 'Alert',
  });
  const quote = await createQuoteVersion(db, {
    requestId: request.id,
    projectId: DEMO.project.id,
    status: 'published',
    priced: { lineItems: [], subtotalCents: 6000, totalCents: 6000 },
    agentOutput: { lineItems: [], needsInfo: [], explanation: '', deliveryDays: 1, confidence: 1 },
  });
  input = { mandateId: DEMO.mandate.id, quote, now };
});
beforeEach(async () => {
  await updateMandate(db, DEMO.mandate.id, {
    status: 'active',
    totalLimitCents: 10000,
    spentCents: 0,
    paypalAuthorizationId: 'AUTH-1',
    fundingAmountCents: 200000,
    fundingCapturedCents: 0,
  });
});
afterAll(async () => {
  await closeDb(db);
});
describe('reserveSpend', () => {
  test('reserves both counters and refuses the second spend', async () => {
    expect(await reserveSpend(db, input)).toEqual({ outcome: 'allow' });
    expect(await reserveSpend(db, input)).toMatchObject({
      outcome: 'needs_approval',
      reason: 'over_total',
    });
    expect(await getMandate(db, DEMO.mandate.id)).toMatchObject({
      spentCents: 6000,
      funding: { fundingCapturedCents: 6000 },
    });
    expect(
      await releaseSpend(db, { mandateId: DEMO.mandate.id, amountCents: 6000, now }),
    ).toMatchObject({ spentCents: 0, funding: { fundingCapturedCents: 0 } });
  });
  test('serializes concurrent reservations', async () => {
    const results = await Promise.all([reserveSpend(db, input), reserveSpend(db, input)]);
    expect(results.filter((r) => r.outcome === 'allow')).toHaveLength(1);
  });
  test('marks exact exhaustion and reactivates on release', async () => {
    await updateMandate(db, DEMO.mandate.id, { totalLimitCents: 6000 });
    await reserveSpend(db, input);
    expect(await getMandate(db, DEMO.mandate.id)).toMatchObject({ status: 'exhausted' });
    expect(
      await releaseSpend(db, { mandateId: DEMO.mandate.id, amountCents: 6000, now }),
    ).toMatchObject({ status: 'active' });
  });
});
