import { type AgentOutput, ProjectSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { resetDemoData, seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import { demoClauses, demoServices } from '../../test/demo.js';
import { priceIntents } from '../quotes/pricing.js';
import { createQuoteVersion } from '../quotes/quotes.js';
import { createRequest } from '../requests/requests.js';
import { appendPaidClauses, getProject, listProjectsForClient } from './projects.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
describe('appendPaidClauses', () => {
  test('appends only extras exactly once under concurrent calls and reset restores scope', async () => {
    const agentOutput: AgentOutput = {
      lineItems: [
        { kind: 'included', scopeRef: 'C1', label: 'Per-branch view', rationale: 'C1' },
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Weekly Monday summary email',
          rationale: 'S2.report',
        },
      ],
      needsInfo: [],
      explanation: 'Summary',
      deliveryDays: 1,
      confidence: 1,
    };
    const request = await createRequest(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      text: 'Summary',
      channel: 'web',
    });
    const quote = await createQuoteVersion(db, {
      requestId: request.id,
      projectId: DEMO.project.id,
      priced: priceIntents(agentOutput.lineItems, {
        services: demoServices(),
        scopeClauses: demoClauses(),
      }),
      agentOutput,
      status: 'published',
    });
    const results = await Promise.all([
      appendPaidClauses(db, DEMO.project.id, quote),
      appendPaidClauses(db, DEMO.project.id, quote),
    ]);
    expect(results.flat()).toEqual([
      {
        id: 'C4',
        text: 'Weekly Monday summary email',
        included: true,
        source: { kind: 'quote', quoteId: quote.id, version: 1 },
      },
    ]);
    expect(await appendPaidClauses(db, DEMO.project.id, quote)).toEqual([]);
    const project = ProjectSchema.parse(await getProject(db, DEMO.project.id));
    expect(project.scopeClauses).toHaveLength(4);
    expect(project.totalContractedCents).toBe(120000);
    expect(await listProjectsForClient(db, DEMO.client.id)).toHaveLength(1);
    await resetDemoData(db);
    expect((await getProject(db, DEMO.project.id)).scopeClauses.map((c) => c.id)).toEqual([
      'C1',
      'C2',
      'C3',
    ]);
  });
});
