import { z } from 'zod';
import { PolicyReasonSchema } from './policy.js';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateTimeSchema } from './primitives.js';

export const PaymentStatusSchema = z.enum([
  'created',
  'approved',
  'captured',
  'denied',
  'refunded',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** `pay_now`: a human approves in PayPal (Flow A). `mandate`: the agent pays within budget (Flow B). */
export const PaymentModeSchema = z.enum(['pay_now', 'mandate']);
export type PaymentMode = z.infer<typeof PaymentModeSchema>;

export const PaymentSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  quoteVersion: z.number().int().positive(),
  mode: PaymentModeSchema,
  paypalOrderId: z.string().optional(),
  paypalAuthorizationId: z.string().optional(),
  paypalCaptureId: z.string().optional(),
  /** The mandate a `mode: 'mandate'` payment was charged against (spec section 4: every autonomous capture points to a mandate). */
  mandateId: IdSchema.optional(),
  amountCents: CentsSchema,
  currency: CurrencySchema,
  status: PaymentStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const AcceptQuoteStatusSchema = z.enum(['paid', 'approval_required', 'denied']);
export type AcceptQuoteStatus = z.infer<typeof AcceptQuoteStatusSchema>;

/**
 * Why an accept did not pay: a policy reason, `no_mandate` (agent without a
 * mandate for this project), or `not_acceptable` (the version is `needs_info`,
 * `draft`, `expired` or `rejected`; a superseded version is `stale_version`).
 */
export const AcceptQuoteReasonSchema = z.union([
  PolicyReasonSchema,
  z.literal('no_mandate'),
  z.literal('not_acceptable'),
]);
export type AcceptQuoteReason = z.infer<typeof AcceptQuoteReasonSchema>;

/** Result of accepting a quote, identical on the web and in the MCP tool. */
export const AcceptQuoteResultSchema = z.object({
  status: AcceptQuoteStatusSchema,
  reason: AcceptQuoteReasonSchema.optional(),
  message: z.string().optional(),
  approvalUrl: z.url().optional(),
  payment: PaymentSchema.optional(),
});
export type AcceptQuoteResult = z.infer<typeof AcceptQuoteResultSchema>;
