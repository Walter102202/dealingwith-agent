import { z } from 'zod';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateTimeSchema } from './primitives.js';

export const MandateStatusSchema = z.enum(['pending', 'active', 'exhausted', 'expired', 'revoked']);
export type MandateStatus = z.infer<typeof MandateStatusSchema>;

/**
 * The PayPal authorization that backs a mandate. Policy limits live on the
 * mandate; funding is the headroom PayPal lets us capture against (spec 7.4).
 */
export const MandateFundingSchema = z.object({
  paypalAuthorizationId: z.string().optional(),
  fundingAmountCents: CentsSchema,
  fundingCapturedCents: CentsSchema,
  fundingExpiresAt: IsoDateTimeSchema.optional(),
});
export type MandateFunding = z.infer<typeof MandateFundingSchema>;

export const MandateSchema = z.object({
  id: IdSchema,
  clientId: IdSchema,
  businessId: IdSchema,
  projectId: IdSchema,
  perPurchaseLimitCents: CentsSchema,
  totalLimitCents: CentsSchema,
  spentCents: CentsSchema,
  currency: CurrencySchema,
  expiresAt: IsoDateTimeSchema,
  status: MandateStatusSchema,
  funding: MandateFundingSchema,
});
export type Mandate = z.infer<typeof MandateSchema>;
