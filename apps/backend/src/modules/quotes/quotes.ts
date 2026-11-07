import { randomUUID } from 'node:crypto';
import {
  type AgentOutput,
  type Quote,
  QuoteSchema,
  type QuoteStatus,
} from '@dealingwith/contracts';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { clients, quotes, requests } from '../../db/schema.js';
import { AppError, notFound } from '../../lib/errors.js';
import { compact, toIsoOrUndefined } from '../../lib/serialize.js';
import type { PricedQuote } from './pricing.js';
export function toQuote(row: typeof quotes.$inferSelect): Quote {
  return QuoteSchema.parse(
    compact({
      ...row,
      id: row.quoteId,
      projectId: row.projectId ?? undefined,
      publishedAt: toIsoOrUndefined(row.publishedAt),
      acceptedAt: toIsoOrUndefined(row.acceptedAt),
      paidAt: toIsoOrUndefined(row.paidAt),
    }),
  );
}
export async function createQuoteVersion(
  db: Db,
  input: {
    requestId: string;
    projectId?: string;
    quoteId?: string;
    priced: PricedQuote;
    agentOutput: AgentOutput;
    status: 'published' | 'needs_info';
    agentRunId?: string;
  },
): Promise<Quote> {
  return db.transaction(async (tx) => {
    // The request exists before the first version, so it serializes all version allocations.
    const [request] = await tx
      .select()
      .from(requests)
      .where(eq(requests.id, input.requestId))
      .for('update');
    if (!request) throw notFound('request', input.requestId);
    const quoteId = input.quoteId ?? randomUUID();
    let version = 1;
    if (input.quoteId) {
      const previous = await getQuote(tx, quoteId);
      if (previous.requestId !== input.requestId)
        throw new AppError('quote_request_mismatch', 'Quote belongs to another request', {
          status: 409,
        });
      version = previous.version + 1;
      await tx
        .update(quotes)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(quotes.quoteId, quoteId),
            inArray(quotes.status, ['published', 'needs_info', 'accepted']),
          ),
        );
    }
    const [row] = await tx
      .insert(quotes)
      .values({
        quoteId,
        version,
        requestId: input.requestId,
        projectId: input.projectId,
        lineItems: input.priced.lineItems,
        subtotalCents: input.priced.subtotalCents,
        totalCents: input.priced.totalCents,
        status: input.status,
        agentRunId: input.agentRunId,
        explanation: input.agentOutput.explanation,
        deliveryDays: input.agentOutput.deliveryDays,
        needsInfo: input.agentOutput.needsInfo,
        publishedAt: input.status === 'published' ? new Date() : null,
        currency: 'USD',
      })
      .returning();
    if (!row)
      throw new AppError('quote_not_created', 'Quote could not be created', { status: 500 });
    return toQuote(row);
  });
}
export async function getQuote(db: Db, quoteId: string, version?: number): Promise<Quote> {
  const [row] = await db
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.quoteId, quoteId),
        version === undefined ? undefined : eq(quotes.version, version),
      ),
    )
    .orderBy(desc(quotes.version))
    .limit(1);
  if (!row) throw notFound('quote', quoteId);
  return toQuote(row);
}
export async function listQuoteVersions(db: Db, quoteId: string): Promise<Quote[]> {
  return (
    await db.select().from(quotes).where(eq(quotes.quoteId, quoteId)).orderBy(asc(quotes.version))
  ).map(toQuote);
}
export async function getLatestPublishedVersion(db: Db, quoteId: string): Promise<number | null> {
  const [row] = await db
    .select({ version: quotes.version })
    .from(quotes)
    .where(and(eq(quotes.quoteId, quoteId), eq(quotes.status, 'published')))
    .orderBy(desc(quotes.version))
    .limit(1);
  return row?.version ?? null;
}
export async function listQuotesForProject(db: Db, projectId: string): Promise<Quote[]> {
  return (
    await db
      .select()
      .from(quotes)
      .where(eq(quotes.projectId, projectId))
      .orderBy(desc(quotes.createdAt), desc(quotes.version))
  ).map(toQuote);
}
export async function listQuotesForBusiness(db: Db, businessId: string): Promise<Quote[]> {
  return (
    await db
      .select({ quote: quotes })
      .from(quotes)
      .innerJoin(requests, eq(quotes.requestId, requests.id))
      .innerJoin(clients, eq(requests.clientId, clients.id))
      .where(eq(clients.businessId, businessId))
      .orderBy(desc(quotes.createdAt))
  ).map(({ quote }) => toQuote(quote));
}
export async function updateQuoteStatus(
  db: Db,
  input: {
    quoteId: string;
    version: number;
    status: QuoteStatus;
    acceptedAt?: Date;
    paidAt?: Date;
  },
): Promise<Quote> {
  const [row] = await db
    .update(quotes)
    .set(compact({ status: input.status, acceptedAt: input.acceptedAt, paidAt: input.paidAt }))
    .where(and(eq(quotes.quoteId, input.quoteId), eq(quotes.version, input.version)))
    .returning();
  if (!row) throw notFound('quote', input.quoteId);
  return toQuote(row);
}
