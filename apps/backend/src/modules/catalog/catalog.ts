import { type Service, ServiceSchema } from '@dealingwith/contracts';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { services } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
export function toService(row: typeof services.$inferSelect): Service {
  return ServiceSchema.parse(row);
}
export async function listServices(db: Db, businessId: string): Promise<Service[]> {
  return (
    await db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(asc(services.name))
  ).map(toService);
}
export async function getService(db: Db, serviceId: string): Promise<Service> {
  const [row] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!row) throw notFound('service', serviceId);
  return toService(row);
}
