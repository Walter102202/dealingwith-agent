import type { DomainEvent, Payment } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { mandates, payments, webhookEvents } from '../db/schema.js';
import { verifyCaptureAmount } from '../integrations/paypal/verify-amount.js';
import { AppError } from '../lib/errors.js';
import { updateMandate } from '../modules/mandates/mandates.js';
import {
  findPaymentByCaptureId,
  findPaymentByOrderId,
  findPaymentForQuoteVersion,
  updatePayment,
} from '../modules/payments/payments.js';
import { releaseSpend } from '../modules/policies/reserve.js';
import { captureApprovedOrder, markPaid, rawRecord } from './capture.js';
import type { Deps } from './deps.js';
import { makeEvent } from './events.js';

const EventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  resource: z.record(z.string(), z.unknown()),
});
async function resolvePayment(
  deps: Deps,
  resource: Record<string, unknown>,
): Promise<Payment | null> {
  const ids = rawRecord(rawRecord(resource.supplementary_data).related_ids);
  let payment =
    typeof resource.id === 'string' ? await findPaymentByCaptureId(deps.db, resource.id) : null;
  if (!payment && typeof ids.capture_id === 'string')
    payment = await findPaymentByCaptureId(deps.db, ids.capture_id);
  if (!payment && typeof ids.order_id === 'string') {
    const found = await findPaymentByOrderId(deps.db, ids.order_id);
    if (found?.mode === 'pay_now') payment = found;
  }
  if (!payment && typeof resource.custom_id === 'string') {
    const match = /^quote:([0-9a-f-]{36}):(\d+)$/.exec(resource.custom_id);
    if (match?.[1] && match[2])
      payment = await findPaymentForQuoteVersion(deps.db, {
        quoteId: match[1],
        version: Number(match[2]),
      });
  }
  return payment;
}
async function dispatch(
  deps: Deps,
  type: string,
  resource: Record<string, unknown>,
): Promise<'processed' | 'ignored'> {
  if (type === 'PAYMENT.AUTHORIZATION.CREATED') return 'processed';
  if (type === 'PAYMENT.AUTHORIZATION.VOIDED') {
    if (typeof resource.id !== 'string') return 'ignored';
    const [row] = await deps.db
      .select()
      .from(mandates)
      .where(eq(mandates.paypalAuthorizationId, resource.id));
    if (!row) return 'ignored';
    const mandate = await updateMandate(deps.db, row.id, {
      status: 'revoked',
      updatedAt: deps.now(),
    });
    deps.events.publish(
      makeEvent(deps, { type: 'mandate.updated', projectId: mandate.projectId, mandate }),
    );
    return 'processed';
  }
  if (type === 'CHECKOUT.ORDER.APPROVED') {
    const payment =
      typeof resource.id === 'string' ? await findPaymentByOrderId(deps.db, resource.id) : null;
    return payment?.mode === 'pay_now' && ['approved', 'captured'].includes(payment.status)
      ? 'processed'
      : 'ignored';
  }
  if (
    !['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED'].includes(
      type,
    )
  )
    return 'ignored';
  const payment = await resolvePayment(deps, resource);
  if (!payment) return 'ignored';
  if (type === 'PAYMENT.CAPTURE.COMPLETED') {
    verifyCaptureAmount(resource.amount, payment.amountCents);
    if (typeof resource.id !== 'string')
      throw new AppError('invalid_webhook', 'Capture id is required');
    await markPaid(deps, {
      quoteId: payment.quoteId,
      version: payment.quoteVersion,
      paymentId: payment.id,
      captureId: resource.id,
      raw: resource,
    });
    return 'processed';
  }
  const [row] = await deps.db
    .select()
    .from(payments)
    .where(eq(payments.id, payment.id))
    .for('update');
  if (!row) return 'ignored';
  if (type === 'PAYMENT.CAPTURE.REFUNDED') {
    await updatePayment(deps.db, payment.id, { status: 'refunded' });
    return 'processed';
  }
  if (row.status === 'captured' || row.status === 'refunded' || row.status === 'denied')
    return 'ignored';
  await updatePayment(deps.db, payment.id, { status: 'denied' });
  if (payment.mode === 'mandate' && typeof row.raw.mandateId === 'string')
    await releaseSpend(deps.db, {
      mandateId: row.raw.mandateId,
      amountCents: payment.amountCents,
      now: deps.now(),
    });
  return 'processed';
}
export async function processWebhook(
  deps: Deps,
  input: { headers: Record<string, string>; rawBody: string },
): Promise<{ result: 'processed' | 'duplicate' | 'ignored' | 'invalid_signature' }> {
  if (!(await deps.paypal.verifyWebhookSignature(input.headers, input.rawBody)))
    return { result: 'invalid_signature' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new AppError('invalid_webhook', 'Webhook body must be JSON');
  }
  const validation = EventSchema.safeParse(parsed);
  if (!validation.success)
    throw new AppError('invalid_webhook', 'Webhook id, type and resource are required');
  const event = validation.data;
  if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && typeof event.resource.id === 'string') {
    const [seen] = await deps.db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.paypalEventId, event.id));
    if (seen) return { result: 'duplicate' };
    const payment = await findPaymentByOrderId(deps.db, event.resource.id);
    // No open transaction during the gateway call: its capture webhook may arrive synchronously.
    if (payment?.mode === 'pay_now' && ['created', 'approved'].includes(payment.status))
      await captureApprovedOrder(deps, { orderId: event.resource.id });
  }
  const pending: DomainEvent[] = [];
  const result = await deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(webhookEvents)
      .values({
        paypalEventId: event.id,
        eventType: event.event_type,
        resourceId: typeof event.resource.id === 'string' ? event.resource.id : null,
        payload: rawRecord(parsed),
      })
      .onConflictDoNothing({ target: webhookEvents.paypalEventId })
      .returning();
    if (!inserted) return 'duplicate' as const;
    const result = await dispatch(
      {
        ...deps,
        db: tx,
        events: {
          ...deps.events,
          publish: (event) => {
            pending.push(event);
          },
        },
      },
      event.event_type,
      event.resource,
    );
    await tx
      .update(webhookEvents)
      .set({ result, processedAt: deps.now() })
      .where(eq(webhookEvents.id, inserted.id));
    return result;
  });
  for (const event of pending) deps.events.publish(event);
  deps.logger.info('webhook.processed', { eventId: event.id, result });
  return { result };
}
