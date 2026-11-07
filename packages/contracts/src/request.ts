import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './primitives.js';

/** Where a request came from: the web app or the MCP server (spec section 7.1). */
export const RequestChannelSchema = z.enum(['web', 'mcp']);
export type RequestChannel = z.infer<typeof RequestChannelSchema>;

/**
 * `open` while the agent runs; `quoted` once a version is published;
 * `needs_info` when the agent asked questions; `failed` when its output could not be priced.
 */
export const RequestStatusSchema = z.enum(['open', 'quoted', 'needs_info', 'failed']);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const RequestSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.optional(),
  clientId: IdSchema,
  channel: RequestChannelSchema,
  agentId: IdSchema.optional(),
  text: z.string().min(1),
  status: RequestStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type Request = z.infer<typeof RequestSchema>;
