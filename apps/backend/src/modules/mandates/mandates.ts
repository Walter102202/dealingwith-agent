import { type Mandate, MandateSchema } from '@dealingwith/contracts';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { mandates } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { compact, toIso, toIsoOrUndefined } from '../../lib/serialize.js';
export function toMandate(row: typeof mandates.$inferSelect): Mandate {
  return MandateSchema.parse({
    ...row,
    expiresAt: toIso(row.expiresAt),
    funding: compact({
      paypalAuthorizationId: row.paypalAuthorizationId ?? undefined,
      fundingAmountCents: row.fundingAmountCents,
      fundingCapturedCents: row.fundingCapturedCents,
      fundingExpiresAt: toIsoOrUndefined(row.fundingExpiresAt),
    }),
  });
}
export async function getMandate(db: Db, id: string): Promise<Mandate> {
  const [row] = await db.select().from(mandates).where(eq(mandates.id, id));
  if (!row) throw notFound('mandate', id);
  return toMandate(row);
}
export async function findMandateForProject(
  db: Db,
  input: { projectId: string; clientId: string },
): Promise<Mandate | null> {
  const [row] = await db
    .select()
    .from(mandates)
    .where(
      and(
        eq(mandates.projectId, input.projectId),
        eq(mandates.clientId, input.clientId),
        ne(mandates.status, 'revoked'),
      ),
    )
    .orderBy(desc(mandates.createdAt))
    .limit(1);
  return row ? toMandate(row) : null;
}
export async function updateMandate(
  db: Db,
  id: string,
  patch: Partial<Omit<typeof mandates.$inferInsert, 'id'>>,
): Promise<Mandate> {
  const [row] = await db.update(mandates).set(patch).where(eq(mandates.id, id)).returning();
  if (!row) throw notFound('mandate', id);
  return toMandate(row);
}
export function remainingCents(m: Mandate): number {
  return Math.max(0, m.totalLimitCents - m.spentCents);
}
export function fundingHeadroomCents(m: Mandate): number {
  return Math.max(0, m.funding.fundingAmountCents - m.funding.fundingCapturedCents);
}
