import type { DomainEvent } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { clients } from '../db/schema.js';
import { getProject } from '../modules/projects/projects.js';
import { getQuote } from '../modules/quotes/quotes.js';
import { getRequest } from '../modules/requests/requests.js';

/**
 * Tenant filter for an event stream that is not pinned to one project
 * (a provider watching the whole business). Every event resolves to the
 * business that owns it: through its project, or for storefront events
 * (no project) through the request behind the quote and its client. Unknown or
 * unresolvable events are dropped. Lookups are memoised per stream.
 */
export function businessScope(db: Db, businessId: string) {
  const cache = new Map<string, Promise<string | undefined>>();
  const memo = (key: string, load: () => Promise<string | undefined>) => {
    let hit = cache.get(key);
    if (!hit) {
      hit = load().catch(() => undefined);
      cache.set(key, hit);
    }
    return hit;
  };
  const businessIdOf = (event: DomainEvent): Promise<string | undefined> => {
    if (event.projectId) {
      const projectId = event.projectId;
      return memo(`project:${projectId}`, async () => (await getProject(db, projectId)).businessId);
    }
    const requestId =
      event.type === 'mandate.updated'
        ? undefined
        : event.type === 'payment.approval_required'
          ? memo(
              `quote:${event.payment.quoteId}`,
              async () => (await getQuote(db, event.payment.quoteId)).requestId,
            )
          : event.quote.requestId;
    if (!requestId) return Promise.resolve(undefined);
    return (async () => {
      const id = await requestId;
      if (!id) return undefined;
      return memo(`request:${id}`, async () => {
        const request = await getRequest(db, id);
        const [client] = await db
          .select({ businessId: clients.businessId })
          .from(clients)
          .where(eq(clients.id, request.clientId));
        return client?.businessId;
      });
    })();
  };
  return {
    async includes(event: DomainEvent): Promise<boolean> {
      return (await businessIdOf(event)) === businessId;
    },
  };
}
