import { z } from 'zod';

/**
 * Wire format of `POST /api/dashboard/assistant/turn`: one turn of the AG Studio
 * chat, answered by Claude through the backend (decision
 * 2026-11-10-assistant-anthropic-adapter-on-backend).
 *
 * The shapes mirror the subset of AG Studio's `AgLlmRequest`, `AgAiEvent` and
 * `AgLlmResponse` this product supports, field for field, so the web adapter
 * forwards them unchanged and type-checks them against `ag-studio`. The backend
 * reads only these schemas and never depends on `ag-studio`. Optional fields
 * use `exactOptional` because AG Studio declares them without `| undefined`.
 */

const ItemStatusSchema = z.enum(['in_progress', 'completed', 'incomplete']);

const InputTextSchema = z.object({ type: z.literal('text'), text: z.string() });

/** A user (or system) message. Attachments are not supported: text parts only. */
export const AssistantInputMessageSchema = z.object({
  id: z.string(),
  kind: z.literal('input'),
  type: z.literal('message'),
  role: z.enum(['user', 'system']),
  content: z.array(InputTextSchema),
  status: ItemStatusSchema,
});

const OutputTextSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  annotations: z.array(z.never()),
});
const RefusalSchema = z.object({ type: z.literal('refusal'), refusal: z.string() });

export const AssistantOutputMessageSchema = z.object({
  id: z.string(),
  kind: z.literal('output'),
  type: z.literal('message'),
  role: z.literal('assistant'),
  status: ItemStatusSchema,
  content: z.array(z.discriminatedUnion('type', [OutputTextSchema, RefusalSchema])),
});

export const AssistantToolCallSchema = z.object({
  id: z.string(),
  kind: z.literal('output'),
  type: z.literal('function_call'),
  callId: z.string().min(1),
  name: z.string().min(1),
  /** JSON-encoded arguments, exactly as the model streamed them. */
  arguments: z.string(),
  status: ItemStatusSchema.exactOptional(),
  result: z.string().exactOptional(),
});

export const AssistantToolResultSchema = z.object({
  id: z.string().exactOptional(),
  kind: z.literal('input').exactOptional(),
  type: z.literal('function_call_output'),
  callId: z.string().min(1),
  output: z.string(),
  status: ItemStatusSchema,
});

/** Reasoning summaries. Accepted in the history and never sent back to the model. */
export const AssistantReasoningSchema = z.object({
  id: z.string(),
  kind: z.literal('output'),
  type: z.literal('reasoning'),
  summary: z.array(z.object({ type: z.literal('summary'), text: z.string() })),
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })).exactOptional(),
});

export const AssistantConversationItemSchema = z.union([
  AssistantInputMessageSchema,
  AssistantOutputMessageSchema,
  AssistantToolCallSchema,
  AssistantToolResultSchema,
  AssistantReasoningSchema,
]);
export type AssistantConversationItem = z.infer<typeof AssistantConversationItemSchema>;

export const AssistantToolSchemaSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  /** JSON Schema of the arguments, as AG Studio builds it. */
  parameters: z.record(z.string(), z.unknown()),
  /** Only client tools exist in this product; provider-hosted tools are refused. */
  kind: z.literal('client').exactOptional(),
});
export type AssistantToolSchema = z.infer<typeof AssistantToolSchemaSchema>;

/** Effort levels the backend allows; the model choice itself stays on the server. */
export const AssistantEffortSchema = z.enum(['low', 'medium']);
export type AssistantEffort = z.infer<typeof AssistantEffortSchema>;

export const AssistantTurnRequestSchema = z.object({
  input: z.array(AssistantConversationItemSchema),
  instructions: z.string().exactOptional(),
  tools: z.array(AssistantToolSchemaSchema).exactOptional(),
  toolChoice: z
    .union([z.enum(['auto', 'none', 'required']), z.object({ name: z.string().min(1) })])
    .exactOptional(),
  /** AG Studio's built-in agents only ask for text; `json` is rejected with its own error code. */
  responseFormat: z.discriminatedUnion('type', [
    z.object({ type: z.literal('text') }),
    z.object({
      type: z.literal('json'),
      name: z.string(),
      description: z.string().exactOptional(),
      schema: z.record(z.string(), z.unknown()),
    }),
  ]),
  model: z
    .object({ id: z.string().min(1), effort: AssistantEffortSchema.exactOptional() })
    .exactOptional(),
});
export type AssistantTurnRequest = z.infer<typeof AssistantTurnRequestSchema>;

/** The content events a turn streams (AG Studio's `AgAiEvent` subset). */
export const AssistantTurnEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT_MESSAGE_START'),
    messageId: z.string(),
    role: z.literal('assistant'),
  }),
  z.object({ type: z.literal('TEXT_MESSAGE_CONTENT'), messageId: z.string(), delta: z.string() }),
  z.object({ type: z.literal('TEXT_MESSAGE_END'), messageId: z.string() }),
  z.object({
    type: z.literal('REASONING_MESSAGE_START'),
    messageId: z.string(),
    role: z.literal('reasoning'),
  }),
  z.object({
    type: z.literal('REASONING_MESSAGE_CONTENT'),
    messageId: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('REASONING_MESSAGE_END'), messageId: z.string() }),
  z.object({
    type: z.literal('TOOL_CALL_START'),
    toolCallId: z.string(),
    toolCallName: z.string(),
  }),
  z.object({ type: z.literal('TOOL_CALL_ARGS'), toolCallId: z.string(), delta: z.string() }),
  z.object({ type: z.literal('TOOL_CALL_END'), toolCallId: z.string() }),
]);
export type AssistantTurnEvent = z.infer<typeof AssistantTurnEventSchema>;

export const AssistantOutputItemSchema = z.union([
  AssistantOutputMessageSchema,
  AssistantReasoningSchema,
  AssistantToolCallSchema,
]);
export type AssistantOutputItem = z.infer<typeof AssistantOutputItemSchema>;

/** The settled turn (AG Studio's `AgLlmResponse` subset). A failed turn is an error frame instead. */
export const AssistantTurnResponseSchema = z.object({
  id: z.string(),
  createdAt: z.number().int(),
  status: z.enum(['completed', 'incomplete']),
  incompleteDetails: z.object({ reason: z.literal('max_output_tokens') }).exactOptional(),
  output: z.array(AssistantOutputItemSchema),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative().exactOptional(),
      cachedInputTokens: z.number().int().nonnegative().exactOptional(),
      cacheWriteTokens: z.number().int().nonnegative().exactOptional(),
    })
    .exactOptional(),
  model: z.string().exactOptional(),
});
export type AssistantTurnResponse = z.infer<typeof AssistantTurnResponseSchema>;

export const AssistantTurnErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type AssistantTurnError = z.infer<typeof AssistantTurnErrorSchema>;

/**
 * One SSE frame's `data`. Content events stream first; exactly one terminal
 * frame follows: `done` with the settled turn, or `error`.
 */
export const AssistantTurnFrameSchema = z.union([
  AssistantTurnEventSchema,
  z.object({ type: z.literal('done'), response: AssistantTurnResponseSchema }),
  z.object({ type: z.literal('error'), error: AssistantTurnErrorSchema }),
]);
export type AssistantTurnFrame = z.infer<typeof AssistantTurnFrameSchema>;
