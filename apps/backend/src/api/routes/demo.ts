import { Hono } from 'hono';
import { resetDemoData } from '../../db/seed.js';
import { notFound } from '../../lib/errors.js';
import { type ApiEnv, requireSession } from '../auth.js';
export function demoRoutes() {
  const app = new Hono<ApiEnv>();
  app.post('/api/demo/reset', requireSession('provider'), async (c) => {
    const deps = c.get('deps');
    if (!deps.env.DEMO_MODE) throw notFound('route', c.req.path);
    await resetDemoData(deps.db);
    return c.json({ ok: true });
  });
  return app;
}
