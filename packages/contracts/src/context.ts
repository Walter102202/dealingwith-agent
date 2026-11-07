import { z } from 'zod';
import { ServiceSchema } from './catalog.js';
import { CentsSchema, CurrencySchema, IdSchema } from './primitives.js';
import { QuoteLineItemSchema, QuoteStatusSchema } from './quote.js';
import { ScopeClauseSchema } from './scope.js';

/**
 * Everything the agent sees for one request (spec section 7.3, "context").
 * Built by Track B, consumed by Track A's `AgentPort`. Every item carries its
 * id so the model can cite clauses and rules instead of inventing them.
 */
export const ContextPackSchema = z.object({
  business: z.object({ name: z.string().min(1), currency: CurrencySchema }),
  services: z.array(ServiceSchema),
  project: z
    .object({ id: IdSchema, title: z.string().min(1), scopeClauses: z.array(ScopeClauseSchema) })
    .nullable(),
  priorQuotes: z.array(
    z.object({
      quoteId: IdSchema,
      version: z.number().int().positive(),
      status: QuoteStatusSchema,
      lineItems: z.array(QuoteLineItemSchema),
    }),
  ),
  mandate: z.object({ perPurchaseLimitCents: CentsSchema, remainingCents: CentsSchema }).nullable(),
  openQuestions: z.array(z.object({ quoteId: IdSchema, question: z.string().min(1) })),
});
export type ContextPack = z.infer<typeof ContextPackSchema>;
