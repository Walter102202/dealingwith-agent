import { z } from 'zod';
import { MandateSchema } from './mandate.js';
import { AcceptQuoteReasonSchema, PaymentSchema } from './payment.js';
import { IdSchema, IsoDateTimeSchema } from './primitives.js';
import { QuoteSchema } from './quote.js';
import { ProjectSchema } from './scope.js';

const eventBase = {
  /** Unique per event; doubles as the SSE `id`. */
  id: z.string().min(1),
  at: IsoDateTimeSchema,
  /** Null for storefront requests that belong to no project. */
  projectId: IdSchema.nullable(),
};

/**
 * What the backend publishes on its in-process bus and streams over
 * `GET /api/events` (spec section 7.7, live updates). The web re-renders from
 * the payload; it never has to refetch to show a paid quote.
 */
export const DomainEventSchema = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('quote.published'), quote: QuoteSchema }),
  z.object({ ...eventBase, type: z.literal('quote.needs_info'), quote: QuoteSchema }),
  z.object({
    ...eventBase,
    type: z.literal('quote.paid'),
    quote: QuoteSchema,
    payment: PaymentSchema.optional(),
    project: ProjectSchema.optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal('payment.approval_required'),
    payment: PaymentSchema,
    approvalUrl: z.url(),
    reason: AcceptQuoteReasonSchema.optional(),
    message: z.string().optional(),
  }),
  z.object({ ...eventBase, type: z.literal('mandate.updated'), mandate: MandateSchema }),
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];
