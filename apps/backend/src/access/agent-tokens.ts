import { createHash, randomBytes } from 'node:crypto';
import {
  AGENT_SCOPES,
  AGENT_TOKEN_PATTERN,
  type ClientAgent,
  ClientAgentSchema,
} from '@dealingwith/contracts';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { clientAgents } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { compact, toIso, toIsoOrUndefined } from '../lib/serialize.js';
import { getMandate } from '../modules/mandates/mandates.js';
export function toClientAgent(row: typeof clientAgents.$inferSelect): ClientAgent {
  return ClientAgentSchema.parse(
    compact({
      id: row.id,
      clientId: row.clientId,
      label: row.label,
      scopes: row.scopes,
      mandateId: row.mandateId ?? undefined,
      createdAt: toIso(row.createdAt),
      lastUsedAt: toIsoOrUndefined(row.lastUsedAt),
      revokedAt: toIsoOrUndefined(row.revokedAt),
    }),
  );
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function issueAgentToken(
  db: Db,
  input: { clientId: string; label: string; mandateId?: string },
): Promise<{ token: string; agent: ClientAgent }> {
  if (!input.label.trim()) throw new AppError('invalid_agent', 'Agent label is required');
  if (input.mandateId && (await getMandate(db, input.mandateId)).clientId !== input.clientId)
    throw new AppError('forbidden', 'Mandate belongs to another client', { status: 403 });
  const token = `dwa_${randomBytes(32).toString('base64url')}`;
  const [row] = await db
    .insert(clientAgents)
    .values({
      clientId: input.clientId,
      label: input.label.trim(),
      mandateId: input.mandateId,
      tokenHash: hash(token),
      scopes: [...AGENT_SCOPES],
    })
    .returning();
  if (!row) throw new AppError('agent_not_created', 'Agent could not be created', { status: 500 });
  return { token, agent: toClientAgent(row) };
}
export async function authenticateAgentToken(db: Db, token: string): Promise<ClientAgent | null> {
  if (!AGENT_TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .update(clientAgents)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(clientAgents.tokenHash, hash(token)), isNull(clientAgents.revokedAt)))
    .returning();
  return row ? toClientAgent(row) : null;
}
export async function revokeAgentToken(
  db: Db,
  input: { agentId: string; clientId: string },
): Promise<ClientAgent> {
  const [row] = await db
    .update(clientAgents)
    .set({ revokedAt: new Date() })
    .where(and(eq(clientAgents.id, input.agentId), eq(clientAgents.clientId, input.clientId)))
    .returning();
  if (!row) throw notFound('agent', input.agentId);
  return toClientAgent(row);
}
export async function listAgents(db: Db, clientId: string): Promise<ClientAgent[]> {
  return (
    await db
      .select()
      .from(clientAgents)
      .where(eq(clientAgents.clientId, clientId))
      .orderBy(desc(clientAgents.createdAt))
  ).map(toClientAgent);
}
