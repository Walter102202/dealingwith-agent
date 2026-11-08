import { type ContextPack, ContextPackSchema } from '@dealingwith/contracts';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as schema from '../../db/schema.js';

export type BuildContextPackInput = { clientId: string; projectId?: string };

type ProjectRow = typeof schema.projects.$inferSelect;
type QuoteRow = typeof schema.quotes.$inferSelect;

/**
 * Everything the agent sees for one request (spec section 7.3). Read straight
 * from the database so the pack always reflects the current scope, including
 * paid additionals appended as clauses. Validated before it leaves this module.
 */
export async function buildContextPack(db: Db, input: BuildContextPackInput): Promise<ContextPack> {
  const client = await loadClient(db, input.clientId);
  const project = input.projectId ? await loadProject(db, input.projectId, client.id) : null;

  const [business] = await db
    .select({ name: schema.businesses.name, currency: schema.businesses.currency })
    .from(schema.businesses)
    .where(eq(schema.businesses.id, client.businessId));
  if (!business) {
    throw new Error(`business ${client.businessId} not found`);
  }

  const services = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.businessId, client.businessId))
    .orderBy(asc(schema.services.createdAt), asc(schema.services.name));

  const quoteRows = await loadQuotes(db, client.id, project);
  const mandate = project ? await loadMandate(db, project.id, client.id) : null;

  return ContextPackSchema.parse({
    business,
    services,
    project: project
      ? { id: project.id, title: project.title, scopeClauses: project.scopeClauses }
      : null,
    priorQuotes: quoteRows.map((q) => ({
      quoteId: q.quoteId,
      version: q.version,
      status: q.status,
      lineItems: q.lineItems,
    })),
    mandate,
    openQuestions: quoteRows
      .filter((q) => q.status === 'needs_info')
      .flatMap((q) => q.needsInfo.map((item) => ({ quoteId: q.quoteId, question: item.question }))),
  });
}

async function loadClient(db: Db, clientId: string) {
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) {
    throw new Error(`client ${clientId} not found`);
  }
  return client;
}

async function loadProject(db: Db, projectId: string, clientId: string): Promise<ProjectRow> {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.clientId, clientId)));
  if (!project) {
    throw new Error(`project ${projectId} not found for client ${clientId}`);
  }
  return project;
}

/** Every version of the project's quotes, or the client's storefront quotes when no project. */
async function loadQuotes(
  db: Db,
  clientId: string,
  project: ProjectRow | null,
): Promise<QuoteRow[]> {
  const requestIds = (
    await db
      .select({ id: schema.requests.id })
      .from(schema.requests)
      .where(
        and(
          eq(schema.requests.clientId, clientId),
          project ? eq(schema.requests.projectId, project.id) : isNull(schema.requests.projectId),
        ),
      )
  ).map((r) => r.id);
  if (requestIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(schema.quotes)
    .where(inArray(schema.quotes.requestId, requestIds))
    .orderBy(asc(schema.quotes.createdAt), asc(schema.quotes.version));
}

async function loadMandate(db: Db, projectId: string, clientId: string) {
  const [mandate] = await db
    .select({
      perPurchaseLimitCents: schema.mandates.perPurchaseLimitCents,
      totalLimitCents: schema.mandates.totalLimitCents,
      spentCents: schema.mandates.spentCents,
    })
    .from(schema.mandates)
    .where(
      and(
        eq(schema.mandates.projectId, projectId),
        eq(schema.mandates.clientId, clientId),
        ne(schema.mandates.status, 'revoked'),
      ),
    )
    .orderBy(asc(schema.mandates.createdAt))
    .limit(1);
  if (!mandate) {
    return null;
  }
  return {
    perPurchaseLimitCents: mandate.perPurchaseLimitCents,
    remainingCents: Math.max(0, mandate.totalLimitCents - mandate.spentCents),
  };
}
