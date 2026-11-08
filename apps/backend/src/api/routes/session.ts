import { Hono } from 'hono';
import { z } from 'zod';
import {
  clearSessionCookieHeader,
  sessionCookieHeader,
  signSession,
} from '../../access/session.js';
import { DEMO } from '../../db/demo-data.js';
import { notFound } from '../../lib/errors.js';
import { type ApiEnv, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';
export function sessionRoutes() {
  const app = new Hono<ApiEnv>();
  app.post(
    '/api/session/login',
    jsonBody(z.object({ role: z.enum(['client', 'provider']) })),
    (c) => {
      const deps = c.get('deps');
      if (!deps.env.DEMO_MODE) throw notFound('route', c.req.path);
      const session =
        c.req.valid('json').role === 'client'
          ? {
              role: 'client' as const,
              clientId: DEMO.client.id,
              businessId: DEMO.business.id,
              name: DEMO.client.contact,
            }
          : { role: 'provider' as const, businessId: DEMO.business.id, name: DEMO.business.name };
      c.header(
        'set-cookie',
        sessionCookieHeader(signSession(session, deps.env.SESSION_SECRET, { now: deps.now() }), {
          secure: deps.env.APP_URL.startsWith('https:'),
        }),
      );
      return c.json(session);
    },
  );
  app.post('/api/session/logout', (c) => {
    c.header('set-cookie', clearSessionCookieHeader());
    return c.json({ ok: true });
  });
  app.get('/api/me', requireSession(), (c) => c.json(c.get('session')));
  return app;
}
