import { z } from 'zod';
import { CentsSchema, IdSchema } from './primitives.js';

/** A versioned pointer to a pricing rule, e.g. `{ id: 'S2.report', version: 1 }`. */
export const RuleRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export type RuleRef = z.infer<typeof RuleRefSchema>;

/** `{ id: 'S2.report', version: 1 }` → `"S2.report.v1"`, as the spec writes rule ids. */
export function ruleRefLabel(ref: RuleRef): string {
  return `${ref.id}.v${ref.version}`;
}

export const PricingRuleTypeSchema = z.enum(['fixed', 'per_unit', 'multiplier']);
export type PricingRuleType = z.infer<typeof PricingRuleTypeSchema>;

const ruleBase = {
  id: z.string().min(1),
  version: z.number().int().positive(),
  label: z.string().min(1),
  conditions: z.string().optional(),
};

/** A fixed amount per line, e.g. US$80 for a scheduled report email. */
export const FixedPricingRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('fixed'),
  amountCents: CentsSchema,
});

/** An amount multiplied by a quantity of `unit`, e.g. US$40 per data source. */
export const PerUnitPricingRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('per_unit'),
  amountCents: CentsSchema,
  unit: z.string().min(1),
});

/** A percentage applied to the other lines of the same service, e.g. rush +25%. */
export const MultiplierPricingRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('multiplier'),
  percent: z.number().nonnegative(),
});

export const PricingRuleSchema = z.discriminatedUnion('type', [
  FixedPricingRuleSchema,
  PerUnitPricingRuleSchema,
  MultiplierPricingRuleSchema,
]);
export type PricingRule = z.infer<typeof PricingRuleSchema>;

export const ServiceSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  name: z.string().min(1),
  description: z.string(),
  pricingRules: z.array(PricingRuleSchema),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  deliveryDays: z.number().int().nonnegative(),
});
export type Service = z.infer<typeof ServiceSchema>;
