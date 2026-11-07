import {
  type Request,
  type RequestChannel,
  RequestSchema,
  type RequestStatus,
} from '@dealingwith/contracts';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { clients, requests } from '../../db/schema.js';
import { AppError, notFound } from '../../lib/errors.js';
import { compact, toIso } from '../../lib/serialize.js';
export function toRequest(row: typeof requests.$inferSelect): Request {
  return RequestSchema.parse(
    compact({
      ...row,
      projectId: row.projectId ?? undefined,
      agentId: row.agentId ?? undefined,
      createdAt: toIso(row.createdAt),
    }),
  );
}
export async function createRequest(
  db: Db,
  input: {
    clientId: string;
    projectId?: string;
    channel: RequestChannel;
    agentId?: string;
    text: string;
  },
): Promise<Request> {
  const text = input.text.trim();
  if (!text || text.length > 2000)
    throw new AppError('invalid_request', 'Text must contain between 1 and 2000 characters');
  const [row] = await db
    .insert(requests)
    .values({ ...input, text, status: 'open' })
    .returning();
  if (!row)
    throw new AppError('request_not_created', 'Request could not be created', { status: 500 });
  return toRequest(row);
}
export async function getRequest(db: Db, id: string): Promise<Request> {
  const [row] = await db.select().from(requests).where(eq(requests.id, id));
  if (!row) throw notFound('request', id);
  return toRequest(row);
}
export async function setRequestStatus(
  db: Db,
  id: string,
  status: RequestStatus,
): Promise<Request> {
  const [row] = await db.update(requests).set({ status }).where(eq(requests.id, id)).returning();
  if (!row) throw notFound('request', id);
  return toRequest(row);
}
export async function listRequestsForBusiness(db: Db, businessId: string): Promise<Request[]> {
  return (
    await db
      .select({ request: requests })
      .from(requests)
      .innerJoin(clients, eq(requests.clientId, clients.id))
      .where(eq(clients.businessId, businessId))
      .orderBy(desc(requests.createdAt))
  ).map(({ request }) => toRequest(request));
}
