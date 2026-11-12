import type {
  AcceptQuoteReason,
  AcceptQuoteResult,
  ClientAgent,
  Payment,
  Quote,
} from '@dealingwith/contracts';
import { and, eq } from 'drizzle-orm';
import { payments, quotes, requests } from '../db/schema.js';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { AppError } from '../lib/errors.js';
import { getMandate, mandateForAgent } from '../modules/mandates/mandates.js';
import {
  createPayment,
  findPaymentForQuoteVersion,
  paymentRow,
  updatePayment,
} from '../modules/payments/payments.js';
import { policyMessage } from '../modules/policies/messages.js';
import { releaseSpend, reserveSpend } from '../modules/policies/reserve.js';
import {
  getLatestPublishedVersion,
  getQuote,
  updateQuoteStatus,
} from '../modules/quotes/quotes.js';
import { getRequest } from '../modules/requests/requests.js';
import { markPaid } from './capture.js';
import type { Deps } from './deps.js';
import { requestApproval } from './pay-now.js';

type Actor = { kind: 'web'; clientId: string } | { kind: 'agent'; agent: ClientAgent };
type Prepared =
  | { result: AcceptQuoteResult }
  | { quote: Quote; payment: Payment | null; reason?: AcceptQuoteReason; message?: string };
export async function acceptQuote(
  deps: Deps,
  input: { quoteId: string; version: number; actor: Actor },
): Promise<AcceptQuoteResult> {
  // Recorded on every payment an agent's accept creates, including the pay-now a person approves,
  // and on the quote version itself, so an accept that needs no payment still names its agent.
  const acceptedBy = input.actor.kind === 'agent' ? { agentId: input.actor.agent.id } : {};
  const acceptedAgent =
    input.actor.kind === 'agent' ? { acceptedAgentId: input.actor.agent.id } : {};
  const prepared: Prepared = await deps.db.transaction(async (tx) => {
    const first = await getQuote(tx, input.quoteId, input.version);
    await tx.select().from(requests).where(eq(requests.id, first.requestId)).for('update');
    const quote = await getQuote(tx, input.quoteId, input.version);
    const request = await getRequest(tx, quote.requestId);
    const clientId = input.actor.kind === 'web' ? input.actor.clientId : input.actor.agent.clientId;
    if (
      clientId !== request.clientId ||
      (input.actor.kind === 'agent' && !input.actor.agent.scopes.includes('quote:accept'))
    )
      throw new AppError('forbidden', 'You cannot accept this quote', { status: 403 });
    const existing = await findPaymentForQuoteVersion(tx, {
      quoteId: quote.id,
      version: quote.version,
    });
    if (quote.status === 'paid')
      return { result: { status: 'paid', ...(existing ? { payment: existing } : {}) } };
    const deny = (
      reason: AcceptQuoteReason,
      latestPublishedVersion: number | null = null,
    ): Prepared => ({
      result: {
        status: 'denied',
        reason,
        message: policyMessage(reason, {
          quote,
          amountCents: quote.totalCents,
          latestPublishedVersion,
        }),
      },
    });
    if (['needs_info', 'draft', 'expired', 'rejected'].includes(quote.status))
      return deny('not_acceptable');
    const latest = await getLatestPublishedVersion(tx, quote.id);
    if (quote.status === 'superseded' || (latest !== quote.version && quote.status !== 'accepted'))
      return deny('stale_version', latest);
    if (quote.totalCents === 0) {
      if (acceptedAgent.acceptedAgentId)
        await tx
          .update(quotes)
          .set(acceptedAgent)
          .where(and(eq(quotes.quoteId, quote.id), eq(quotes.version, quote.version)));
      return { quote, payment: null };
    }
    if (existing) return { quote, payment: existing };
    let reason: AcceptQuoteReason | undefined;
    let message: string | undefined;
    if (input.actor.kind === 'agent') {
      const mandate = await mandateForAgent(tx, input.actor.agent, quote.projectId);
      if (mandate && mandate.clientId !== clientId)
        throw new AppError('forbidden', 'Mandate belongs to another client', { status: 403 });
      if (mandate) {
        const decision = await reserveSpend(tx, { mandateId: mandate.id, quote, now: deps.now() });
        if (decision.outcome === 'deny')
          return {
            result: { status: 'denied', reason: decision.reason, message: decision.message },
          };
        if (decision.outcome === 'allow') {
          if (!mandate.funding.paypalAuthorizationId) {
            await releaseSpend(tx, {
              mandateId: mandate.id,
              amountCents: quote.totalCents,
              now: deps.now(),
            });
            throw new AppError('missing_authorization', 'Mandate funding is missing', {
              status: 409,
            });
          }
          const payment = await createPayment(tx, {
            quoteId: quote.id,
            quoteVersion: quote.version,
            mode: 'mandate',
            amountCents: quote.totalCents,
            idempotencyKey: `mandate:${quote.id}:${quote.version}`,
            ...acceptedBy,
            paypalAuthorizationId: mandate.funding.paypalAuthorizationId,
            raw: { mandateId: mandate.id },
          });
          await updateQuoteStatus(tx, {
            quoteId: quote.id,
            version: quote.version,
            status: 'accepted',
            acceptedAt: deps.now(),
            ...acceptedAgent,
          });
          return { quote, payment };
        }
        reason = decision.reason;
        message = decision.message;
      } else {
        reason = 'no_mandate';
        message = policyMessage(reason, { amountCents: quote.totalCents });
      }
    }
    const payment = await createPayment(tx, {
      quoteId: quote.id,
      quoteVersion: quote.version,
      mode: 'pay_now',
      amountCents: quote.totalCents,
      idempotencyKey: `pay:${quote.id}:${quote.version}`,
      ...acceptedBy,
      raw: { ...(reason ? { reason } : {}), ...(message ? { message } : {}) },
    });
    await updateQuoteStatus(tx, {
      quoteId: quote.id,
      version: quote.version,
      status: 'accepted',
      acceptedAt: deps.now(),
      ...acceptedAgent,
    });
    return { quote, payment, ...(reason ? { reason } : {}), ...(message ? { message } : {}) };
  });
  if ('result' in prepared) return prepared.result;
  const { quote } = prepared;
  let payment = prepared.payment;
  if (!payment) {
    await markPaid(deps, { quoteId: quote.id, version: quote.version });
    return {
      status: 'paid',
      message: 'Nothing to pay: everything requested is already included in the project scope.',
    };
  }
  let row = await paymentRow(deps.db, payment.id);
  if (payment.mode === 'mandate') {
    const mandatePayment = payment;
    if (row.status !== 'denied')
      try {
        const capture = await deps.paypal.captureAuthorization(
          payment.paypalAuthorizationId ?? '',
          {
            amountCents: payment.amountCents,
            finalCapture: false,
            requestId: row.idempotencyKey,
            invoiceId: `mandate:${quote.id}:${quote.version}`,
          },
        );
        // PENDING may still complete at PayPal: ambiguous, so treated like a 5xx below.
        if (capture.status !== 'COMPLETED') throw new PaypalError('CAPTURE_NOT_COMPLETED', 502);
        if (capture.amountCents !== quote.totalCents)
          throw new AppError('payment_mismatch', 'Captured amount differs from the quote', {
            status: 409,
          });
        const paid = await markPaid(deps, {
          quoteId: quote.id,
          version: quote.version,
          paymentId: payment.id,
          captureId: capture.captureId,
          raw: capture.raw,
        });
        return { status: 'paid', ...(paid.payment ? { payment: paid.payment } : {}) };
      } catch (error) {
        // Only a definitive decline (4xx: amount exceeded, instrument declined, authorization
        // gone) releases the reservation and offers a human order. A 5xx, a timeout or a pending
        // capture may still have taken the money: keep the payment and the spend as they are and
        // let the caller retry with the same idempotency key (the webhook reconciles by invoice).
        if (!(error instanceof PaypalError) || error.status >= 500) throw error;
        await deps.db.transaction(async (tx) => {
          const [locked] = await tx
            .select()
            .from(payments)
            .where(eq(payments.id, mandatePayment.id))
            .for('update');
          if (locked && locked.status !== 'denied' && locked.status !== 'captured') {
            await releaseSpend(tx, {
              mandateId: String(row.raw.mandateId),
              amountCents: mandatePayment.amountCents,
              now: deps.now(),
            });
            await updatePayment(tx, mandatePayment.id, { status: 'denied' });
          }
        });
      }
    const mandate = await getMandate(deps.db, String(row.raw.mandateId));
    prepared.reason = 'funding_exhausted';
    prepared.message = policyMessage('funding_exhausted', {
      amountCents: quote.totalCents,
      mandate,
    });
    payment = await createPayment(deps.db, {
      quoteId: quote.id,
      quoteVersion: quote.version,
      mode: 'pay_now',
      amountCents: quote.totalCents,
      idempotencyKey: `pay:${quote.id}:${quote.version}`,
      ...acceptedBy,
      raw: { reason: prepared.reason, message: prepared.message },
    });
    row = await paymentRow(deps.db, payment.id);
  }
  return requestApproval(deps, quote, payment.id, prepared);
}
