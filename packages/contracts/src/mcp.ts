import { z } from 'zod';
import { ServiceSchema } from './catalog.js';
import { MandateSchema } from './mandate.js';
import { AcceptQuoteResultSchema, PaymentSchema } from './payment.js';
import { IdSchema } from './primitives.js';
import { QuoteSchema } from './quote.js';
import { ProjectSchema } from './scope.js';

/** The eight tools of spec section 7.6, in the order the spec lists them. */
export const MCP_TOOL_NAMES = [
  'list_services',
  'get_project',
  'request_quote',
  'answer_questions',
  'get_quote',
  'accept_quote',
  'get_payment',
  'get_mandate',
] as const;
export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);
export type McpToolName = z.infer<typeof McpToolNameSchema>;

export const ListServicesInputSchema = z.strictObject({});
export const ListServicesOutputSchema = z.object({ services: z.array(ServiceSchema) });

export const GetProjectInputSchema = z.strictObject({ projectId: IdSchema });
export const GetProjectOutputSchema = z.object({ project: ProjectSchema });

export const RequestQuoteInputSchema = z.strictObject({
  projectId: IdSchema.optional(),
  text: z.string().min(1, 'text is required').max(2000),
  /** Storefront purchase of one service: a single `fixed` rule is priced without the agent (A9). */
  serviceId: IdSchema.optional(),
});
export const RequestQuoteOutputSchema = z.object({ quote: QuoteSchema });

export const AnswerQuestionsInputSchema = z.strictObject({
  quoteId: IdSchema,
  answers: z.record(z.string(), z.string()),
});
export const AnswerQuestionsOutputSchema = z.object({ quote: QuoteSchema });

export const GetQuoteInputSchema = z.strictObject({ quoteId: IdSchema });
export const GetQuoteOutputSchema = z.object({ quote: QuoteSchema });

export const AcceptQuoteInputSchema = z.strictObject({
  quoteId: IdSchema,
  version: z.number().int().positive(),
});
export const AcceptQuoteOutputSchema = AcceptQuoteResultSchema;

export const GetPaymentInputSchema = z.strictObject({ paymentId: IdSchema });
export const GetPaymentOutputSchema = z.object({ payment: PaymentSchema });

export const GetMandateInputSchema = z.strictObject({});
export const GetMandateOutputSchema = z.object({ mandate: MandateSchema.nullable() });

export type ListServicesInput = z.infer<typeof ListServicesInputSchema>;
export type ListServicesOutput = z.infer<typeof ListServicesOutputSchema>;
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;
export type GetProjectOutput = z.infer<typeof GetProjectOutputSchema>;
export type RequestQuoteInput = z.infer<typeof RequestQuoteInputSchema>;
export type RequestQuoteOutput = z.infer<typeof RequestQuoteOutputSchema>;
export type AnswerQuestionsInput = z.infer<typeof AnswerQuestionsInputSchema>;
export type AnswerQuestionsOutput = z.infer<typeof AnswerQuestionsOutputSchema>;
export type GetQuoteInput = z.infer<typeof GetQuoteInputSchema>;
export type GetQuoteOutput = z.infer<typeof GetQuoteOutputSchema>;
export type AcceptQuoteInput = z.infer<typeof AcceptQuoteInputSchema>;
export type AcceptQuoteOutput = z.infer<typeof AcceptQuoteOutputSchema>;
export type GetPaymentInput = z.infer<typeof GetPaymentInputSchema>;
export type GetPaymentOutput = z.infer<typeof GetPaymentOutputSchema>;
export type GetMandateInput = z.infer<typeof GetMandateInputSchema>;
export type GetMandateOutput = z.infer<typeof GetMandateOutputSchema>;

/** Input and output schema per tool, for the MCP server to register from one table. */
export const MCP_TOOLS = {
  list_services: { input: ListServicesInputSchema, output: ListServicesOutputSchema },
  get_project: { input: GetProjectInputSchema, output: GetProjectOutputSchema },
  request_quote: { input: RequestQuoteInputSchema, output: RequestQuoteOutputSchema },
  answer_questions: { input: AnswerQuestionsInputSchema, output: AnswerQuestionsOutputSchema },
  get_quote: { input: GetQuoteInputSchema, output: GetQuoteOutputSchema },
  accept_quote: { input: AcceptQuoteInputSchema, output: AcceptQuoteOutputSchema },
  get_payment: { input: GetPaymentInputSchema, output: GetPaymentOutputSchema },
  get_mandate: { input: GetMandateInputSchema, output: GetMandateOutputSchema },
} as const satisfies Record<McpToolName, { input: z.ZodType; output: z.ZodType }>;
