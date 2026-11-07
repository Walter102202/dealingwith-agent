import { z } from 'zod';
import { RuleRefSchema } from './catalog.js';

/**
 * What the model may say about one line. Objects are strict so that any amount
 * the model emits is a validation error, never a price (spec section 4).
 */
export const IncludedLineItemIntentSchema = z.strictObject({
  kind: z.literal('included'),
  /** The scope clause that already covers this need, e.g. `C1`. */
  scopeRef: z.string().min(1),
  label: z.string().min(1),
  rationale: z.string().min(1),
});

export const RuleLineItemIntentSchema = z.strictObject({
  kind: z.literal('rule'),
  ref: RuleRefSchema,
  quantity: z.number().int().positive().default(1),
  params: z.record(z.string(), z.unknown()).optional(),
  label: z.string().min(1),
  rationale: z.string().min(1),
});

export const LineItemIntentSchema = z.discriminatedUnion('kind', [
  IncludedLineItemIntentSchema,
  RuleLineItemIntentSchema,
]);
export type LineItemIntent = z.infer<typeof LineItemIntentSchema>;
export type IncludedLineItemIntent = z.infer<typeof IncludedLineItemIntentSchema>;
export type RuleLineItemIntent = z.infer<typeof RuleLineItemIntentSchema>;

export const NeedsInfoItemSchema = z.object({
  question: z.string().min(1),
  whyItChangesPrice: z.string().min(1),
});
export type NeedsInfoItem = z.infer<typeof NeedsInfoItemSchema>;

/** The structured output every agent run must satisfy (spec section 7.3). */
export const AgentOutputSchema = z.strictObject({
  lineItems: z.array(LineItemIntentSchema),
  needsInfo: z.array(NeedsInfoItemSchema),
  explanation: z.string(),
  deliveryDays: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
