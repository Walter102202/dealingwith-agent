import type { AcceptQuoteReason, AcceptQuoteResult, Quote } from '@dealingwith/contracts';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { AppError } from '../lib/errors.js';
import { getPayment, paymentRow, updatePayment } from '../modules/payments/payments.js';
import { markPaid, rawRecord } from './capture.js';
import type { Deps } from './deps.js';
import { makeEvent } from './events.js';

export async function requestApproval(
  deps: Deps,
  quote: Quote,
  paymentId: string,
  overrides: { reason?: AcceptQuoteReason; message?: string } = {},
): Promise<AcceptQuoteResult> {
  const row = await paymentRow(deps.db, paymentId);
  if (row.status === 'captured')
    return { status: 'paid', payment: await getPayment(deps.db, row.id) };
  let approvalUrl = typeof row.raw.approveUrl === 'string' ? row.raw.approveUrl : undefined;
  let renew = !row.paypalOrderId || !approvalUrl;
  if (row.paypalOrderId) {
    try {
      const order = await deps.paypal.getOrder(row.paypalOrderId);
      if (order.status === 'COMPLETED') {
        // PayPal already took the money (a crash between capture and markPaid, or a webhook
        // rejected before the webhook id existed). Reconcile; never open a second order.
        if (!order.captureId || order.amountCents !== quote.totalCents)
          throw new AppError('payment_mismatch', 'PayPal capture could not be verified', {
            status: 409,
          });
        const paid = await markPaid(deps, {
          quoteId: quote.id,
          version: quote.version,
          paymentId: row.id,
          captureId: order.captureId,
          raw: order.raw,
        });
        return { status: 'paid', ...(paid.payment ? { payment: paid.payment } : {}) };
      }
      renew ||= order.status === 'EXPIRED' || order.status === 'VOIDED';
    } catch (error) {
      if (
        !(error instanceof PaypalError) ||
        !['ORDER_EXPIRED', 'RESOURCE_NOT_FOUND'].includes(error.code)
      )
        throw error;
      renew = true;
    }
  }
  if (renew) {
    const attempts =
      typeof row.raw.orderAttempts === 'number' ? row.raw.orderAttempts : row.paypalOrderId ? 1 : 0;
    const order = await deps.paypal.createOrder({
      intent: 'CAPTURE',
      amountCents: quote.totalCents,
      customId: `quote:${quote.id}:${quote.version}`,
      requestId: attempts === 0 ? row.idempotencyKey : `${row.idempotencyKey}:${attempts}`,
      returnUrl: `${deps.env.APP_URL}/pay/return`,
      cancelUrl: `${deps.env.APP_URL}/pay/cancel`,
    });
    approvalUrl = order.approveUrl;
    await updatePayment(deps.db, row.id, {
      status: 'created',
      paypalOrderId: order.orderId,
      raw: {
        ...row.raw,
        ...rawRecord(order.raw),
        approveUrl: approvalUrl,
        orderAttempts: attempts + 1,
      },
    });
  }
  const reason = overrides.reason ?? (row.raw.reason as AcceptQuoteReason | undefined);
  const message = overrides.message ?? (row.raw.message as string | undefined);
  // An existing URL or a newly created order always supplies this value.
  if (!approvalUrl) throw new PaypalError('APPROVAL_URL_MISSING', 502);
  const result = {
    status: 'approval_required' as const,
    approvalUrl,
    payment: await getPayment(deps.db, row.id),
    ...(reason ? { reason } : {}),
    ...(message ? { message } : {}),
  };
  deps.events.publish(
    makeEvent(deps, {
      type: 'payment.approval_required',
      projectId: quote.projectId ?? null,
      ...result,
    }),
  );
  return result;
}
