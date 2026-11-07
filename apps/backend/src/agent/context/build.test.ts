import { ContextPackSchema } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import * as schema from '../../db/schema.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import { buildContextPack } from './build.js';
import { renderContextPack } from './render.js';

const QUOTE_ID = '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a99';

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});

afterAll(async () => {
  await closeDb(db);
});

describe('buildContextPack', () => {
  test('the pack for P1 has 3 services, 3 clauses and the mandate summary', async () => {
    const pack = await buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });

    expect(pack.business).toEqual({ name: 'Andes Data Studio', currency: 'USD' });
    expect(pack.services.map((s) => s.name)).toEqual([
      'Analytics dashboard build',
      'Automations',
      'Data source integration',
    ]);
    expect(pack.project?.title).toBe('Retail KPI dashboard');
    expect(pack.project?.scopeClauses.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
    expect(pack.mandate).toEqual({ perPurchaseLimitCents: 10000, remainingCents: 30000 });
    expect(pack.priorQuotes).toEqual([]);
    expect(pack.openQuestions).toEqual([]);
    expect(() => ContextPackSchema.parse(pack)).not.toThrow();
  });

  test('without a project the pack has a null project and a null mandate', async () => {
    const pack = await buildContextPack(db, { clientId: DEMO.client.id });
    expect(pack.project).toBeNull();
    expect(pack.mandate).toBeNull();
    expect(pack.services).toHaveLength(3);
  });

  test('a project of another client is not disclosed', async () => {
    const [other] = await db
      .insert(schema.clients)
      .values({ businessId: DEMO.business.id, name: 'Other Co', email: 'other@example.com' })
      .returning();
    await expect(
      buildContextPack(db, { clientId: other?.id ?? '', projectId: DEMO.project.id }),
    ).rejects.toThrow(/project .* not found/i);
  });

  test('remainingCents is the total limit minus what the mandate already spent', async () => {
    await db
      .update(schema.mandates)
      .set({ spentCents: 6000 })
      .where(eq(schema.mandates.id, DEMO.mandate.id));
    const pack = await buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });
    expect(pack.mandate?.remainingCents).toBe(24000);
    await db
      .update(schema.mandates)
      .set({ spentCents: 0 })
      .where(eq(schema.mandates.id, DEMO.mandate.id));
  });

  test('prior quote versions and open questions from needs_info versions are in the pack', async () => {
    const [request] = await db
      .insert(schema.requests)
      .values({
        clientId: DEMO.client.id,
        projectId: DEMO.project.id,
        channel: 'web',
        text: 'Make the dashboard load faster.',
        status: 'needs_info',
      })
      .returning();
    await db.insert(schema.quotes).values({
      quoteId: QUOTE_ID,
      version: 1,
      requestId: request?.id ?? '',
      projectId: DEMO.project.id,
      status: 'needs_info',
      needsInfo: [
        {
          question: 'Is the slowness caused by data volume or by the dashboard design?',
          whyItChangesPrice: 'More data means an integration; a redesign means a new build.',
        },
      ],
    });

    const pack = await buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });

    expect(pack.priorQuotes).toEqual([
      { quoteId: QUOTE_ID, version: 1, status: 'needs_info', lineItems: [] },
    ]);
    expect(pack.openQuestions).toEqual([
      {
        quoteId: QUOTE_ID,
        question: 'Is the slowness caused by data volume or by the dashboard design?',
      },
    ]);
    expect(() => ContextPackSchema.parse(pack)).not.toThrow();
  });

  test('after a paid additional is appended, the pack has 4 clauses and the fourth comes from a quote', async () => {
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, DEMO.project.id));
    await db
      .update(schema.projects)
      .set({
        scopeClauses: [
          ...(project?.scopeClauses ?? []),
          {
            id: 'C4',
            text: 'Weekly Monday summary email',
            included: true,
            source: { kind: 'quote', quoteId: QUOTE_ID, version: 1 },
          },
        ],
      })
      .where(eq(schema.projects.id, DEMO.project.id));

    const pack = await buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });

    expect(pack.project?.scopeClauses).toHaveLength(4);
    expect(pack.project?.scopeClauses[3]).toMatchObject({
      id: 'C4',
      included: true,
      source: { kind: 'quote', quoteId: QUOTE_ID, version: 1 },
    });
  });
});

describe('renderContextPack', () => {
  test('renders every clause and rule with its id visible so the model can cite it', async () => {
    const pack = await buildContextPack(db, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
    });
    const text = renderContextPack(pack);

    expect(text).toContain('[C1] included — Five views including a per-branch view');
    expect(text).toContain('[C2] excluded — Automations, scheduled emails and alerts');
    expect(text).toContain('[C4] included — Weekly Monday summary email (paid additional');
    expect(text).toContain('[S2.report.v1] fixed US$80.00 — Scheduled report email');
    expect(text).toContain('[S3.per_source.v1] US$40.00 per source — Per data source');
    expect(text).toContain('[S3.rush.v1] +25% — Rush under 48 h');
    expect(text).toContain('US$100.00 per purchase');
    expect(text).toContain('Is the slowness caused by data volume or by the dashboard design?');
    expect(text).not.toMatch(/\bundefined\b/);
  });

  test('renders a storefront pack without a project', () => {
    const text = renderContextPack({
      business: { name: 'Andes Data Studio', currency: 'USD' },
      services: [],
      project: null,
      priorQuotes: [],
      mandate: null,
      openQuestions: [],
    });
    expect(text).toContain('No project yet');
    expect(text).not.toMatch(/\bundefined\b/);
  });
});
