import { z } from 'zod';
import { CentsSchema, IdSchema } from './primitives.js';

/** Where a scope clause came from: the original contract, or a paid quote version. */
export const ScopeClauseSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contract') }),
  z.object({ kind: z.literal('quote'), quoteId: IdSchema, version: z.number().int().positive() }),
]);
export type ScopeClauseSource = z.infer<typeof ScopeClauseSourceSchema>;

/**
 * One clause of a project's scope, e.g. C1 "five views including a per-branch view".
 * Contract clauses are never edited; paid extras are appended with `source.kind = 'quote'`.
 */
export const ScopeClauseSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  included: z.boolean(),
  source: ScopeClauseSourceSchema,
});
export type ScopeClause = z.infer<typeof ScopeClauseSchema>;

export const ProjectStatusSchema = z.enum(['in_progress', 'completed', 'cancelled']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  clientId: IdSchema,
  serviceId: IdSchema,
  title: z.string().min(1),
  status: ProjectStatusSchema,
  scopeClauses: z.array(ScopeClauseSchema),
  totalContractedCents: CentsSchema,
});
export type Project = z.infer<typeof ProjectSchema>;
