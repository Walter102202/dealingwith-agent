import { z } from 'zod';

/** Why a mandate did not allow a payment. The message is shown to users verbatim. */
export const PolicyReasonSchema = z.enum([
  'mandate_inactive',
  'mandate_expired',
  'wrong_project',
  'currency_mismatch',
  'stale_version',
  'over_per_purchase',
  'over_total',
  'funding_exhausted',
]);
export type PolicyReason = z.infer<typeof PolicyReasonSchema>;

export const PolicyDecisionSchema = z.union([
  z.object({ outcome: z.literal('allow') }),
  z.object({
    outcome: z.enum(['needs_approval', 'deny']),
    reason: PolicyReasonSchema,
    message: z.string().min(1),
  }),
]);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
