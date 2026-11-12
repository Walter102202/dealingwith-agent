import { z } from 'zod';
import { ClientAgentSchema } from './access.js';
import { ServiceSchema } from './catalog.js';
import { MandateSchema } from './mandate.js';
import { PaymentModeSchema, PaymentSchema, PaymentStatusSchema } from './payment.js';
import { CentsSchema, IdSchema, IsoDateTimeSchema } from './primitives.js';
import { QuoteSchema, QuoteStatusSchema } from './quote.js';
import { RequestChannelSchema, RequestStatusSchema } from './request.js';
import { ProjectSchema } from './scope.js';

/** Shapes that exist only at the HTTP boundary, shared by the backend routes and the web client. */

export const PaypalModeSchema = z.enum(['mock', 'sandbox']);
export type PaypalMode = z.infer<typeof PaypalModeSchema>;

/** `GET /api/config`: what the web needs before any session exists. */
export const AppConfigSchema = z.object({
  paypalMode: PaypalModeSchema,
  /** Present in sandbox mode only; the web passes it to the PayPal JS SDK. */
  paypalClientId: z.string().min(1).optional(),
  appUrl: z.url(),
  demoMode: z.boolean(),
  /** The dashboard's AI assistant; enabled when the server holds an Anthropic key. */
  assistant: z.object({ enabled: z.boolean() }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** `GET /api/projects/:id`: everything the project page renders in one round trip. */
export const ProjectViewSchema = z.object({
  project: ProjectSchema,
  service: ServiceSchema,
  quotes: z.array(QuoteSchema),
  payments: z.array(PaymentSchema),
  mandate: MandateSchema.nullable(),
  agents: z.array(ClientAgentSchema),
});
export type ProjectView = z.infer<typeof ProjectViewSchema>;

/** Every error response: `{ error: { code, message, details? } }`. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * `GET /api/dashboard/data`: flat rows for the provider dashboard (AG Studio
 * takes arrays of plain objects). Amounts stay in cents; the web formats them.
 */
export const DashboardQuoteRowSchema = z.object({
  quoteId: IdSchema,
  version: z.number().int().positive(),
  status: QuoteStatusSchema,
  channel: RequestChannelSchema,
  requestText: z.string(),
  clientName: z.string(),
  projectTitle: z.string().nullable(),
  includedLines: z.number().int().nonnegative(),
  extraLines: z.number().int().nonnegative(),
  totalCents: CentsSchema,
  createdAt: IsoDateTimeSchema,
  paidAt: IsoDateTimeSchema.nullable(),
});
export type DashboardQuoteRow = z.infer<typeof DashboardQuoteRowSchema>;

/** One row per quote line, so revenue and unpaid additionals group by service and rule. */
export const DashboardLineRowSchema = z.object({
  quoteId: IdSchema,
  version: z.number().int().positive(),
  quoteStatus: QuoteStatusSchema,
  kind: z.enum(['included', 'rule']),
  label: z.string(),
  ruleId: z.string().nullable(),
  serviceName: z.string().nullable(),
  amountCents: CentsSchema,
  clientName: z.string(),
  projectTitle: z.string().nullable(),
  channel: RequestChannelSchema,
  createdAt: IsoDateTimeSchema,
  paidAt: IsoDateTimeSchema.nullable(),
});
export type DashboardLineRow = z.infer<typeof DashboardLineRowSchema>;

export const DashboardPaymentRowSchema = z.object({
  paymentId: IdSchema,
  quoteId: IdSchema,
  version: z.number().int().positive(),
  mode: PaymentModeSchema,
  status: PaymentStatusSchema,
  /** Name of the client's agent whose accept created the payment; null when a person accepted on the web. */
  agentName: z.string().nullable(),
  clientName: z.string(),
  projectTitle: z.string().nullable(),
  amountCents: CentsSchema,
  createdAt: IsoDateTimeSchema,
  capturedAt: IsoDateTimeSchema.nullable(),
});
export type DashboardPaymentRow = z.infer<typeof DashboardPaymentRowSchema>;

export const DashboardRequestRowSchema = z.object({
  requestId: IdSchema,
  channel: RequestChannelSchema,
  status: RequestStatusSchema,
  clientName: z.string(),
  projectTitle: z.string().nullable(),
  text: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type DashboardRequestRow = z.infer<typeof DashboardRequestRowSchema>;

export const DashboardDataSchema = z.object({
  quotes: z.array(DashboardQuoteRowSchema),
  lines: z.array(DashboardLineRowSchema),
  payments: z.array(DashboardPaymentRowSchema),
  requests: z.array(DashboardRequestRowSchema),
  services: z.array(ServiceSchema),
  mandate: MandateSchema.nullable(),
  generatedAt: IsoDateTimeSchema,
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;
