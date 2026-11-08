import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { clients } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
export type ClientRecord = { id: string; businessId: string; name: string; email: string };
export async function getClient(db: Db, clientId: string): Promise<ClientRecord> {
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!row) throw notFound('client', clientId);
  return { id: row.id, businessId: row.businessId, name: row.name, email: row.email };
}
