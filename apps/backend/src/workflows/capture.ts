import type { Payment, Quote, ScopeClause } from '@dealingwith/contracts';
import { and, eq } from 'drizzle-orm';
import { quotes } from '../db/schema.js';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { AppError, notFound } from '../lib/errors.js';
import { compact } from '../lib/serialize.js';
import {
  findPaymentByOrderId,
  findPaymentForQuoteVersion,
  getPayment,
  paymentRow,
  updatePayment,
} from '../modules/payments/payments.js';
import { appendPaidClauses, getProject } from '../modules/projects/projects.js';
import { getQuote, toQuote, updateQuoteStatus } from '../modules/quotes/quotes.js';
import type { Deps } from './deps.js';
import { makeEvent } from './events.js';
export const rawRecord = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
export async function markPaid(
  deps: Deps,
  input: {
    quoteId: string;
    version: number;
    paymentId?: string;
    captureId?: string;
    raw?: unknown;
  },
): Promise<{ quote: Quote; payment?: Payment; appendedClauses: ScopeClause[] }> {
  const result = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.quoteId, input.quoteId), eq(quotes.version, input.version)))
      .for('update');
    if (!row) throw notFound('quote', input.quoteId);
    let quote = toQuote(row);
    const existing = await findPaymentForQuoteVersion(tx, {
      quoteId: input.quoteId,
      version: input.version,
    });
    if (row.status === 'paid')
      return {
        quote,
        ...(existing ? { payment: existing } : {}),
        appendedClauses: [],
        changed: false,
      };
    let payment: Payment | undefined;
    if (input.paymentId) {
      const stored = await paymentRow(tx, input.paymentId);
      if (
        stored.quoteId !== input.quoteId ||
        stored.quoteVersion !== input.version ||
        stored.amountCents !== quote.totalCents
      )
        throw new AppError('payment_mismatch', 'Payment does not match the quote', { status: 409 });
      payment = await updatePayment(
        tx,
        input.paymentId,
        compact({
          status: 'captured' as const,
          ...(input.captureId ? { paypalCaptureId: input.captureId } : {}),
          raw: { ...stored.raw, ...rawRecord(input.raw) },
        }),
      );
    } else if (quote.totalCents !== 0)
      throw new AppError('payment_required', 'This quote requires a payment', { status: 409 });
    quote = await updateQuoteStatus(tx, {
      quoteId: input.quoteId,
      version: input.version,
      status: 'paid',
      paidAt: deps.now(),
    });
    const appendedClauses = quote.projectId
      ? await appendPaidClauses(tx, quote.projectId, quote)
      : [];
    return { quote, ...(payment ? { payment } : {}), appendedClauses, changed: true };
  });
  if (result.changed) {
    const project = result.quote.projectId
      ? await getProject(deps.db, result.quote.projectId)
      : undefined;
    deps.events.publish(
      makeEvent(deps, {
        type: 'quote.paid',
        projectId: result.quote.projectId ?? null,
        quote: result.quote,
        ...(result.payment ? { payment: result.payment } : {}),
        ...(project ? { project } : {}),
      }),
    );
  }
  return {
    quote: result.quote,
    ...(result.payment ? { payment: result.payment } : {}),
    appendedClauses: result.appendedClauses,
  };
}
export async function captureApprovedOrder(
  deps: Deps,
  input: { orderId: string },
): Promise<Payment> {
  const payment = await findPaymentByOrderId(deps.db, input.orderId);
  if (!payment) throw notFound('payment', input.orderId);
  if (payment.status === 'captured') return payment;
  if ((await getQuote(deps.db, payment.quoteId, payment.quoteVersion)).status === 'paid')
    throw new AppError(
      'quote_already_paid',
      'This quote was already paid through another payment',
      {
        status: 409,
      },
    );
  const row = await paymentRow(deps.db, payment.id);
  try {
    const capture = await deps.paypal.captureOrder(input.orderId, row.idempotencyKey);
    if (capture.amountCents !== payment.amountCents)
      throw new AppError('payment_mismatch', 'Captured amount differs from the quote', {
        status: 409,
      });
    if (capture.status === 'COMPLETED')
      await markPaid(deps, {
        quoteId: payment.quoteId,
        version: payment.quoteVersion,
        paymentId: payment.id,
        captureId: capture.captureId,
        raw: capture.raw,
      });
    else
      await updatePayment(deps.db, payment.id, {
        status: capture.status === 'PENDING' ? 'approved' : 'denied',
      });
  } catch (error) {
    if (error instanceof PaypalError && error.code === 'ORDER_NOT_APPROVED')
      throw new AppError('order_not_approved', 'Approve the order in PayPal before capturing it', {
        status: 409,
      });
    if (!(error instanceof PaypalError) || error.code !== 'ORDER_ALREADY_CAPTURED') throw error;
    const order = await deps.paypal.getOrder(input.orderId);
    if (!order.captureId || order.amountCents !== payment.amountCents)
      throw new AppError('payment_mismatch', 'PayPal capture could not be verified', {
        status: 409,
      });
    await markPaid(deps, {
      quoteId: payment.quoteId,
      version: payment.quoteVersion,
      paymentId: payment.id,
      captureId: order.captureId,
      raw: order.raw,
    });
  }
  return getPayment(deps.db, payment.id);
}
