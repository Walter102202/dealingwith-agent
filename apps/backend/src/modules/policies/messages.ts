import type { AcceptQuoteReason, Mandate, Quote } from '@dealingwith/contracts';
import { formatUsd } from '../../lib/format.js';
import { fundingHeadroomCents, remainingCents } from '../mandates/mandates.js';
export function policyMessage(
  reason: AcceptQuoteReason,
  ctx: {
    amountCents: number;
    mandate?: Mandate;
    quote?: Quote;
    latestPublishedVersion?: number | null;
  },
): string {
  const { mandate: m, quote: q } = ctx;
  const amount = formatUsd(ctx.amountCents);
  switch (reason) {
    case 'mandate_inactive':
      return m?.status === 'pending'
        ? 'The client has not assigned a budget to this agent yet; they can do it on the project page. Approve this payment in PayPal.'
        : `The mandate is ${m?.status}; the agent can only pay from an active mandate. Approve this payment in PayPal.`;
    case 'mandate_expired':
      return `The mandate expired on ${m?.expiresAt.slice(0, 10)}. Approve this payment in PayPal or set a new mandate.`;
    case 'wrong_project':
      return 'This quote belongs to another project; the mandate covers only its own project.';
    case 'currency_mismatch':
      return `The quote is in ${q?.currency}; the mandate pays in ${m?.currency}.`;
    case 'stale_version':
      return ctx.latestPublishedVersion == null
        ? `Quote version ${q?.version} cannot be accepted; there is no published version.`
        : `Quote version ${q?.version} is no longer current; the latest published version is ${ctx.latestPublishedVersion}.`;
    case 'over_per_purchase':
      return `${amount} exceeds the per-purchase limit of ${formatUsd(m?.perPurchaseLimitCents ?? 0)}. Approve this payment in PayPal.`;
    case 'over_total':
      return `${amount} would exceed the remaining mandate budget of ${formatUsd(m ? remainingCents(m) : 0)}. Approve this payment in PayPal.`;
    case 'funding_exhausted':
      return `${amount} exceeds the remaining PayPal authorization of ${formatUsd(m ? fundingHeadroomCents(m) : 0)}. Approve this payment in PayPal or re-authorize the mandate.`;
    case 'no_mandate':
      return 'No mandate covers this project; approve this payment in PayPal.';
    case 'not_acceptable':
      return `Quote version ${q?.version} is ${q?.status} and cannot be accepted.`;
  }
}
