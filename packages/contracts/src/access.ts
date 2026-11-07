import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './primitives.js';

/**
 * A demo session (spec section 3: no real authentication). Signed into the
 * `dw_session` cookie by the backend; `GET /api/me` returns it as is.
 */
export const SessionSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('client'),
    clientId: IdSchema,
    businessId: IdSchema,
    name: z.string().min(1),
  }),
  z.object({ role: z.literal('provider'), businessId: IdSchema, name: z.string().min(1) }),
]);
export type Session = z.infer<typeof SessionSchema>;

/** What an agent token may do. Every token issued in the portal gets both. */
export const AGENT_SCOPES = ['quote:request', 'quote:accept'] as const;
export const AgentScopeSchema = z.enum(AGENT_SCOPES);
export type AgentScope = z.infer<typeof AgentScopeSchema>;

/** A connected client agent as the portal shows it. The token itself is never returned again. */
export const ClientAgentSchema = z.object({
  id: IdSchema,
  clientId: IdSchema,
  label: z.string().min(1),
  scopes: z.array(AgentScopeSchema),
  mandateId: IdSchema.optional(),
  createdAt: IsoDateTimeSchema,
  lastUsedAt: IsoDateTimeSchema.optional(),
  revokedAt: IsoDateTimeSchema.optional(),
});
export type ClientAgent = z.infer<typeof ClientAgentSchema>;

/** Agent tokens: `dwa_` plus 32 random bytes in base64url (43 characters). */
export const AGENT_TOKEN_PATTERN = /^dwa_[A-Za-z0-9_-]{43}$/;
export const AgentTokenSchema = z.string().regex(AGENT_TOKEN_PATTERN, 'invalid agent token');

/** Ready-to-paste MCP configuration per client (spec G4). */
export const ConnectionSnippetsSchema = z.object({
  claudeDesktop: z.string().min(1),
  claudeCode: z.string().min(1),
  cursor: z.string().min(1),
});
export type ConnectionSnippets = z.infer<typeof ConnectionSnippetsSchema>;

/** Response of `POST /api/agents`: the only time the plain token is visible. */
export const IssuedAgentSchema = z.object({
  token: AgentTokenSchema,
  agent: ClientAgentSchema,
  snippets: ConnectionSnippetsSchema,
});
export type IssuedAgent = z.infer<typeof IssuedAgentSchema>;
