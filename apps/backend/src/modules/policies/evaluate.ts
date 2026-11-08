import type { Mandate, PolicyDecision, PolicyReason, Quote } from '@dealingwith/contracts';
import { policyMessage } from './messages.js';
export function evaluate(input: {
  mandate: Mandate;
  quote: Quote;
  latestPublishedVersion: number | null;
  now: Date;
}): PolicyDecision {
  const { mandate: m, quote: q, latestPublishedVersion, now } = input;
  const fail = (outcome: 'deny' | 'needs_approval', reason: PolicyReason): PolicyDecision => ({
    outcome,
    reason,
    message: policyMessage(reason, { ...input, amountCents: q.totalCents }),
  });
  if (['pending', 'expired', 'revoked'].includes(m.status)) return fail('deny', 'mandate_inactive');
  if (new Date(m.expiresAt) < now) return fail('deny', 'mandate_expired');
  if (q.projectId !== m.projectId) return fail('deny', 'wrong_project');
  if (q.currency !== m.currency) return fail('deny', 'currency_mismatch');
  if (latestPublishedVersion === null || q.version !== latestPublishedVersion)
    return fail('deny', 'stale_version');
  if (q.totalCents > m.perPurchaseLimitCents) return fail('needs_approval', 'over_per_purchase');
  if (m.spentCents + q.totalCents > m.totalLimitCents) return fail('needs_approval', 'over_total');
  if (m.funding.fundingCapturedCents + q.totalCents > m.funding.fundingAmountCents)
    return fail('needs_approval', 'funding_exhausted');
  return { outcome: 'allow' };
}
