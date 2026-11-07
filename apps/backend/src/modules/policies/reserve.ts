import type { Mandate, PolicyDecision, Quote } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { mandates } from '../../db/schema.js';
import { AppError, notFound } from '../../lib/errors.js';
import { toMandate, updateMandate } from '../mandates/mandates.js';
import { getLatestPublishedVersion } from '../quotes/quotes.js';
import { evaluate } from './evaluate.js';
export async function reserveSpend(
  db: Db,
  input: { mandateId: string; quote: Quote; now: Date },
): Promise<PolicyDecision> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(mandates)
      .where(eq(mandates.id, input.mandateId))
      .for('update');
    if (!row) throw notFound('mandate', input.mandateId);
    const decision = evaluate({
      mandate: toMandate(row),
      quote: input.quote,
      now: input.now,
      latestPublishedVersion: await getLatestPublishedVersion(tx, input.quote.id),
    });
    if (decision.outcome === 'allow') {
      const spentCents = row.spentCents + input.quote.totalCents;
      await updateMandate(tx, row.id, {
        spentCents,
        fundingCapturedCents: row.fundingCapturedCents + input.quote.totalCents,
        status: spentCents >= row.totalLimitCents ? 'exhausted' : row.status,
        updatedAt: input.now,
      });
    }
    return decision;
  });
}
export async function releaseSpend(
  db: Db,
  input: { mandateId: string; amountCents: number; now: Date },
): Promise<Mandate> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0)
    throw new AppError('invalid_amount', 'Release amount must be non-negative integer cents');
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(mandates)
      .where(eq(mandates.id, input.mandateId))
      .for('update');
    if (!row) throw notFound('mandate', input.mandateId);
    const spentCents = Math.max(0, row.spentCents - input.amountCents);
    return updateMandate(tx, row.id, {
      spentCents,
      fundingCapturedCents: Math.max(0, row.fundingCapturedCents - input.amountCents),
      status:
        row.status === 'exhausted' && spentCents < row.totalLimitCents ? 'active' : row.status,
      updatedAt: input.now,
    });
  });
}
