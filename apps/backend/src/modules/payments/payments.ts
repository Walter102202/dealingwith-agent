import {
  type Payment,
  type PaymentMode,
  PaymentSchema,
  type PaymentStatus,
} from '@dealingwith/contracts';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { clients, payments, quotes, requests } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { compact, toIso } from '../../lib/serialize.js';
export function toPayment(row: typeof payments.$inferSelect): Payment {
  return PaymentSchema.parse(
    compact({
      ...row,
      mandateId: row.mode === 'mandate' ? row.raw.mandateId : undefined,
      agentId: row.agentId ?? undefined,
      paypalOrderId: row.paypalOrderId ?? undefined,
      paypalAuthorizationId: row.paypalAuthorizationId ?? undefined,
      paypalCaptureId: row.paypalCaptureId ?? undefined,
      createdAt: toIso(row.createdAt),
    }),
  );
}
export async function createPayment(
  db: Db,
  input: {
    quoteId: string;
    quoteVersion: number;
    mode: PaymentMode;
    amountCents: number;
    idempotencyKey: string;
    agentId?: string;
    paypalOrderId?: string;
    paypalAuthorizationId?: string;
    raw?: Record<string, unknown>;
  },
): Promise<Payment> {
  await db.insert(payments).values(input).onConflictDoNothing({ target: payments.idempotencyKey });
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.idempotencyKey, input.idempotencyKey));
  if (!row) throw notFound('payment', input.idempotencyKey);
  return toPayment(row);
}
export async function paymentRow(db: Db, id: string): Promise<typeof payments.$inferSelect> {
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  if (!row) throw notFound('payment', id);
  return row;
}
export async function getPayment(db: Db, id: string): Promise<Payment> {
  return toPayment(await paymentRow(db, id));
}
export async function findPaymentByOrderId(db: Db, id: string): Promise<Payment | null> {
  const [row] = await db.select().from(payments).where(eq(payments.paypalOrderId, id));
  return row ? toPayment(row) : null;
}
export async function findPaymentByCaptureId(db: Db, id: string): Promise<Payment | null> {
  const [row] = await db.select().from(payments).where(eq(payments.paypalCaptureId, id));
  return row ? toPayment(row) : null;
}
export async function findPaymentForQuoteVersion(
  db: Db,
  input: { quoteId: string; version: number; mode?: PaymentMode },
): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.quoteId, input.quoteId),
        eq(payments.quoteVersion, input.version),
        input.mode ? eq(payments.mode, input.mode) : undefined,
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return row ? toPayment(row) : null;
}
export async function updatePayment(
  db: Db,
  id: string,
  patch: {
    status?: PaymentStatus;
    paypalOrderId?: string;
    paypalAuthorizationId?: string;
    paypalCaptureId?: string;
    raw?: Record<string, unknown>;
  },
): Promise<Payment> {
  const [row] = await db
    .update(payments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(payments.id, id))
    .returning();
  if (!row) throw notFound('payment', id);
  return toPayment(row);
}
const quoteJoin = and(
  eq(payments.quoteId, quotes.quoteId),
  eq(payments.quoteVersion, quotes.version),
);
export async function listPaymentsForProject(db: Db, projectId: string): Promise<Payment[]> {
  return (
    await db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(quotes, quoteJoin)
      .where(eq(quotes.projectId, projectId))
      .orderBy(desc(payments.createdAt))
  ).map(({ payment }) => toPayment(payment));
}
export async function listPaymentsForBusiness(db: Db, businessId: string): Promise<Payment[]> {
  return (
    await db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(quotes, quoteJoin)
      .innerJoin(requests, eq(quotes.requestId, requests.id))
      .innerJoin(clients, eq(requests.clientId, clients.id))
      .where(eq(clients.businessId, businessId))
      .orderBy(desc(payments.createdAt))
  ).map(({ payment }) => toPayment(payment));
}
