import type { AcceptQuoteResult, Payment } from '@dealingwith/contracts';
import { fixtureId } from '../demo-ids.js';
import { nowIso, state } from '../state.js';
import { appendPaidClauses, latestQuote, notFound, origin, pad } from './shared.js';

export const paymentsHandlers = {
  async acceptQuote(id: string, body: { version: number }): Promise<AcceptQuoteResult> {
    const latest = latestQuote(id);
    if (body.version !== latest.version) {
      return {
        status: 'denied',
        reason: 'stale_version',
        message: `Quote v${body.version} was replaced by v${latest.version}.`,
      };
    }
    if (latest.status === 'paid') {
      const paid = state.payments.find((p) => p.quoteId === id && p.status === 'captured');
      return { status: 'paid', ...(paid ? { payment: paid } : {}) };
    }
    if (latest.status !== 'published' && latest.status !== 'accepted') {
      return {
        status: 'denied',
        reason: 'not_acceptable',
        message: 'This quote still needs your answers before it can be accepted.',
      };
    }
    if (latest.totalCents === 0) {
      latest.status = 'paid';
      latest.paidAt = nowIso();
      appendPaidClauses(latest);
      return {
        status: 'paid',
        message: 'Nothing to pay: everything requested is already included in the project scope.',
      };
    }
    let payment = state.payments.find((p) => p.quoteId === id && p.quoteVersion === latest.version);
    if (!payment) {
      payment = {
        id: fixtureId('d', ++state.counters.payment),
        quoteId: id,
        quoteVersion: latest.version,
        mode: 'pay_now',
        paypalOrderId: `MOCK-ORDER-${pad(++state.counters.order)}`,
        amountCents: latest.totalCents,
        currency: 'USD',
        status: 'created',
        createdAt: nowIso(),
      };
      state.payments.push(payment);
      latest.status = 'accepted';
      latest.acceptedAt = nowIso();
    }
    return {
      status: 'approval_required',
      approvalUrl: `${origin()}/pay/return?token=${payment.paypalOrderId}`,
      payment,
    };
  },

  async captureOrder(orderId: string): Promise<Payment> {
    const payment = state.payments.find((p) => p.paypalOrderId === orderId);
    if (!payment) throw notFound('Order');
    if (payment.status === 'captured') return payment;
    payment.status = 'captured';
    payment.paypalCaptureId = `MOCK-CAPTURE-${pad(state.payments.filter((p) => p.paypalCaptureId).length + 1)}`;
    const quote = state.quotes.find(
      (q) => q.id === payment.quoteId && q.version === payment.quoteVersion,
    );
    if (quote) {
      quote.status = 'paid';
      quote.paidAt = nowIso();
      appendPaidClauses(quote);
    }
    return payment;
  },

  getPayment(id: string): Payment {
    const payment = state.payments.find((p) => p.id === id);
    if (!payment) throw notFound('Payment');
    return payment;
  },
};
