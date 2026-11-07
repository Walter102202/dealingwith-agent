import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { DEMO } from './demo-data.js';
import * as schema from './schema.js';

/**
 * Seeds the demo scenario (spec section 6). Idempotent: the catalog (business,
 * services, client) is upserted by fixed id; the project and the mandate are
 * created only when missing, so a redeploy never destroys live demo state or
 * the mandate's PayPal funding. `resetDemoData` is the explicit restore.
 */
export async function seedDemo(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.businesses)
      .values({
        id: DEMO.business.id,
        name: DEMO.business.name,
        country: DEMO.business.country,
        currency: DEMO.business.currency,
        demoMode: true,
      })
      .onConflictDoUpdate({
        target: schema.businesses.id,
        set: { name: DEMO.business.name, country: DEMO.business.country, demoMode: true },
      });

    for (const service of Object.values(DEMO.services)) {
      const row = {
        businessId: DEMO.business.id,
        name: service.name,
        description: service.description,
        pricingRules: [...service.pricingRules],
        inclusions: [...service.inclusions],
        exclusions: [...service.exclusions],
        deliveryDays: service.deliveryDays,
      };
      await tx
        .insert(schema.services)
        .values({ id: service.id, ...row })
        .onConflictDoUpdate({ target: schema.services.id, set: row });
    }

    await tx
      .insert(schema.clients)
      .values({
        id: DEMO.client.id,
        businessId: DEMO.business.id,
        name: DEMO.client.name,
        email: DEMO.client.email,
      })
      .onConflictDoUpdate({
        target: schema.clients.id,
        set: { name: DEMO.client.name, email: DEMO.client.email },
      });

    await tx
      .insert(schema.projects)
      .values({
        id: DEMO.project.id,
        businessId: DEMO.business.id,
        clientId: DEMO.client.id,
        serviceId: DEMO.project.serviceId,
        title: DEMO.project.title,
        status: DEMO.project.status,
        scopeClauses: [...DEMO.project.scopeClauses],
        totalContractedCents: DEMO.project.totalContractedCents,
        contractedAt: DEMO.project.contractedAt,
      })
      .onConflictDoNothing({ target: schema.projects.id });

    await tx
      .insert(schema.mandates)
      .values({
        id: DEMO.mandate.id,
        clientId: DEMO.client.id,
        businessId: DEMO.business.id,
        projectId: DEMO.project.id,
        perPurchaseLimitCents: DEMO.mandate.perPurchaseLimitCents,
        totalLimitCents: DEMO.mandate.totalLimitCents,
        spentCents: 0,
        currency: DEMO.mandate.currency,
        expiresAt: DEMO.mandate.expiresAt,
        status: DEMO.mandate.status,
        fundingAmountCents: DEMO.mandate.fundingAmountCents,
        fundingCapturedCents: DEMO.mandate.fundingCapturedCents,
      })
      .onConflictDoNothing({ target: schema.mandates.id });
  });
}

/**
 * "Reset demo data": removes everything the demo produced and restores the
 * scripted starting point. The mandate's funding (PayPal authorization id,
 * funding amount, funding captured) and its status survive, because a seed
 * cannot re-approve a PayPal authorization (spec section 6).
 */
export async function resetDemoData(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Order follows the foreign keys: runs and payments before quotes, quotes before requests,
    // requests before the agents they reference.
    await tx.delete(schema.agentRuns);
    await tx.delete(schema.webhookEvents);
    await tx.delete(schema.payments);
    await tx.delete(schema.quotes);
    await tx.delete(schema.requests);
    await tx.delete(schema.clientAgents);

    await tx
      .update(schema.projects)
      .set({
        status: DEMO.project.status,
        scopeClauses: [...DEMO.project.scopeClauses],
        totalContractedCents: DEMO.project.totalContractedCents,
      })
      .where(eq(schema.projects.id, DEMO.project.id));

    await tx
      .update(schema.mandates)
      .set({
        spentCents: 0,
        perPurchaseLimitCents: DEMO.mandate.perPurchaseLimitCents,
        totalLimitCents: DEMO.mandate.totalLimitCents,
        expiresAt: DEMO.mandate.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.mandates.id, DEMO.mandate.id));
  });
}
