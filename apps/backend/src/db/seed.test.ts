import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { DEMO } from './demo-data.js';
import * as schema from './schema.js';
import { resetDemoData, seedDemo } from './seed.js';
import { createTestDb } from './test-db.js';

describe('seedDemo', () => {
  test('seeding twice yields one business, three services, one project with C1–C3, one pending mandate', async () => {
    const db = await createTestDb();
    await seedDemo(db);
    await seedDemo(db);

    expect(await db.select().from(schema.businesses)).toHaveLength(1);
    expect(await db.select().from(schema.services)).toHaveLength(3);
    expect(await db.select().from(schema.clients)).toHaveLength(1);

    const projects = await db.select().from(schema.projects);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.scopeClauses.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
    expect(projects[0]?.totalContractedCents).toBe(120000);

    const mandates = await db.select().from(schema.mandates);
    expect(mandates).toHaveLength(1);
    expect(mandates[0]).toMatchObject({
      status: 'pending',
      perPurchaseLimitCents: 10000,
      totalLimitCents: 30000,
      fundingAmountCents: 200000,
      fundingCapturedCents: 0,
    });
  });

  test('uses the spec prices and rule ids', async () => {
    const db = await createTestDb();
    await seedDemo(db);
    const [s3] = await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, DEMO.services.S3.id));
    expect(s3?.pricingRules.map((r) => `${r.id}.v${r.version}`)).toEqual([
      'S3.base.v1',
      'S3.per_source.v1',
      'S3.rush.v1',
    ]);
    expect(s3?.pricingRules[0]).toMatchObject({ type: 'fixed', amountCents: 15000 });
    expect(s3?.pricingRules[1]).toMatchObject({
      type: 'per_unit',
      amountCents: 4000,
      unit: 'source',
    });
    expect(s3?.pricingRules[2]).toMatchObject({ type: 'multiplier', percent: 25 });
  });
});

describe('resetDemoData', () => {
  test('restores clauses and spent while keeping the mandate funding', async () => {
    const db = await createTestDb();
    await seedDemo(db);

    const [project] = await db.select().from(schema.projects);
    await db
      .update(schema.projects)
      .set({
        scopeClauses: [
          ...(project?.scopeClauses ?? []),
          {
            id: 'C4',
            text: 'Weekly Monday summary email',
            included: true,
            source: { kind: 'quote', quoteId: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a99', version: 1 },
          },
        ],
      })
      .where(eq(schema.projects.id, DEMO.project.id));
    await db
      .update(schema.mandates)
      .set({
        spentCents: 6000,
        status: 'active',
        paypalAuthorizationId: 'AUTH-DEMO-1',
        fundingCapturedCents: 6000,
      })
      .where(eq(schema.mandates.id, DEMO.mandate.id));

    await resetDemoData(db);

    const [afterProject] = await db.select().from(schema.projects);
    expect(afterProject?.scopeClauses.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
    const [afterMandate] = await db.select().from(schema.mandates);
    expect(afterMandate).toMatchObject({
      spentCents: 0,
      status: 'active',
      paypalAuthorizationId: 'AUTH-DEMO-1',
      fundingAmountCents: 200000,
      fundingCapturedCents: 6000,
    });
  });

  test('deletes requests, quotes, payments, webhook events, agent runs and client agents', async () => {
    const db = await createTestDb();
    await seedDemo(db);

    const [request] = await db
      .insert(schema.requests)
      .values({ clientId: DEMO.client.id, projectId: DEMO.project.id, channel: 'web', text: 'x' })
      .returning();
    const requestId = request?.id ?? '';
    const [quote] = await db
      .insert(schema.quotes)
      .values({ version: 1, requestId, projectId: DEMO.project.id })
      .returning();
    await db.insert(schema.payments).values({
      quoteId: quote?.quoteId ?? '',
      quoteVersion: 1,
      mode: 'pay_now',
      amountCents: 8000,
      idempotencyKey: 'pay-1',
    });
    await db.insert(schema.webhookEvents).values({
      paypalEventId: 'WH-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      payload: {},
    });
    await db.insert(schema.agentRuns).values({
      requestId,
      provider: 'mock',
      model: 'mock',
      promptVersion: 'v1',
      outcome: 'ok',
    });
    await db
      .insert(schema.clientAgents)
      .values({ clientId: DEMO.client.id, label: "Mara's assistant", tokenHash: 'hash-1' });

    await resetDemoData(db);

    expect(await db.select().from(schema.requests)).toHaveLength(0);
    expect(await db.select().from(schema.quotes)).toHaveLength(0);
    expect(await db.select().from(schema.payments)).toHaveLength(0);
    expect(await db.select().from(schema.webhookEvents)).toHaveLength(0);
    expect(await db.select().from(schema.agentRuns)).toHaveLength(0);
    expect(await db.select().from(schema.clientAgents)).toHaveLength(0);
    expect(await db.select().from(schema.services)).toHaveLength(3);
  });
});
