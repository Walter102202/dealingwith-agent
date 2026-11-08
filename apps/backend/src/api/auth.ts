import type { Session } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, verifySession } from '../access/session.js';
import type { Db } from '../db/client.js';
import { clients } from '../db/schema.js';
import type { Env } from '../env.js';
import { AppError } from '../lib/errors.js';
import { getProject } from '../modules/projects/projects.js';
import { getQuote } from '../modules/quotes/quotes.js';
import { getRequest } from '../modules/requests/requests.js';
import type { Deps } from '../workflows/deps.js';
export type ApiEnv = { Variables: { deps: Deps; session: Session } };
export function readSession(c: Context, env: Env): Session | null {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? verifySession(token, env.SESSION_SECRET, new Date()) : null;
}
export function requireSession(role?: 'client' | 'provider'): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const deps = c.get('deps');
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? verifySession(token, deps.env.SESSION_SECRET, deps.now()) : null;
    if (!session) throw new AppError('unauthenticated', 'Sign in to continue', { status: 401 });
    if (role && session.role !== role)
      throw new AppError('forbidden', 'This action requires another role', { status: 403 });
    c.set('session', session);
    await next();
  };
}
export function clientId(c: Context<ApiEnv>): string {
  const s = c.get('session');
  if (s.role !== 'client')
    throw new AppError('forbidden', 'A client session is required', { status: 403 });
  return s.clientId;
}
export async function requireClientOwnsProject(db: Db, projectId: string, session: Session) {
  const project = await getProject(db, projectId);
  if (
    project.businessId !== session.businessId ||
    (session.role === 'client' && project.clientId !== session.clientId)
  )
    throw new AppError('forbidden', 'You cannot access this project', { status: 403 });
  return project;
}
export async function requireOwnsQuote(
  db: Db,
  quoteId: string,
  session: Session,
  version?: number,
) {
  const quote = await getQuote(db, quoteId, version);
  const request = await getRequest(db, quote.requestId);
  if (session.role === 'client' && request.clientId !== session.clientId)
    throw new AppError('forbidden', 'You cannot access this quote', { status: 403 });
  if (quote.projectId) {
    await requireClientOwnsProject(db, quote.projectId, session);
  } else {
    // Storefront quote: the tenant is the request's client, not a project.
    const [client] = await db
      .select({ businessId: clients.businessId })
      .from(clients)
      .where(eq(clients.id, request.clientId));
    if (client?.businessId !== session.businessId)
      throw new AppError('forbidden', 'You cannot access this quote', { status: 403 });
  }
  return quote;
}
