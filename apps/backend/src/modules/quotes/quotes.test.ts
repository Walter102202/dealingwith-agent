import { type AgentOutput, QuoteSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import { createRequest } from '../requests/requests.js';
import {
  createQuoteVersion,
  getLatestPublishedVersion,
  getQuote,
  listQuoteVersions,
} from './quotes.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
const agentOutput: AgentOutput = {
  lineItems: [],
  explanation: 'Test quote',
  needsInfo: [],
  deliveryDays: 0,
  confidence: 1,
};
const priced = { lineItems: [], subtotalCents: 0, totalCents: 0 };
describe('createQuoteVersion', () => {
  test('supersedes the old version and returns the latest valid contract', async () => {
    const request = await createRequest(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      text: 'Quote',
      channel: 'web',
    });
    const input = {
      requestId: request.id,
      projectId: DEMO.project.id,
      priced,
      agentOutput,
      status: 'published' as const,
    };
    const first = await createQuoteVersion(db, input);
    // A Quote structurally satisfies PricedQuote; its version must never override allocation.
    const second = await createQuoteVersion(db, { ...input, quoteId: first.id, priced: first });
    expect(second).toMatchObject({ id: first.id, version: 2, status: 'published' });
    expect(await getQuote(db, first.id, 1)).toMatchObject({ status: 'superseded' });
    expect(await getQuote(db, first.id)).toEqual(second);
    expect(await getLatestPublishedVersion(db, first.id)).toBe(2);
    expect(QuoteSchema.parse(second)).toEqual(second);
    expect((await listQuoteVersions(db, first.id)).map((q) => q.version)).toEqual([1, 2]);
    const versions = await Promise.all([
      createQuoteVersion(db, { ...input, quoteId: first.id }),
      createQuoteVersion(db, { ...input, quoteId: first.id }),
    ]);
    expect(versions.map((q) => q.version).sort()).toEqual([3, 4]);
  });
  test('does not publish a quote needing information', async () => {
    const request = await createRequest(db, {
      clientId: DEMO.client.id,
      text: 'Clarify',
      channel: 'web',
    });
    const quote = await createQuoteVersion(db, {
      requestId: request.id,
      priced,
      agentOutput,
      status: 'needs_info',
    });
    expect(quote).not.toHaveProperty('publishedAt');
    expect(quote).not.toHaveProperty('projectId');
    expect(await getLatestPublishedVersion(db, quote.id)).toBeNull();
  });
});
