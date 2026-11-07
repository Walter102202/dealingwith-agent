import { z } from 'zod';
import {
  IncludedLineItemIntentSchema,
  NeedsInfoItemSchema,
  RuleLineItemIntentSchema,
} from './agent.js';
import { RuleRefSchema } from './catalog.js';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateTimeSchema } from './primitives.js';

export const QuoteStatusSchema = z.enum([
  'draft',
  'needs_info',
  'published',
  'accepted',
  'paid',
  'superseded',
  'expired',
  'rejected',
]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

const pricedFields = {
  unitAmountCents: CentsSchema,
  amountCents: CentsSchema,
};

/** An included line: the intent plus US$0 amounts. */
export const IncludedQuoteLineItemSchema = IncludedLineItemIntentSchema.extend(pricedFields);

/** A priced line: the intent plus amounts and the rule version the engine resolved. */
export const RuleQuoteLineItemSchema = RuleLineItemIntentSchema.extend({
  ...pricedFields,
  ruleRef: RuleRefSchema,
});

export const QuoteLineItemSchema = z.discriminatedUnion('kind', [
  IncludedQuoteLineItemSchema,
  RuleQuoteLineItemSchema,
]);
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

/**
 * One version of a quote. `id` is stable across versions; `(id, version)` is
 * what accept and pay reference (spec section 7.1).
 */
export const QuoteSchema = z.object({
  id: IdSchema,
  requestId: IdSchema,
  projectId: IdSchema.optional(),
  version: z.number().int().positive(),
  status: QuoteStatusSchema,
  lineItems: z.array(QuoteLineItemSchema),
  subtotalCents: CentsSchema,
  totalCents: CentsSchema,
  currency: CurrencySchema,
  explanation: z.string(),
  deliveryDays: z.number().int().nonnegative(),
  needsInfo: z.array(NeedsInfoItemSchema),
  publishedAt: IsoDateTimeSchema.optional(),
  acceptedAt: IsoDateTimeSchema.optional(),
  paidAt: IsoDateTimeSchema.optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;
