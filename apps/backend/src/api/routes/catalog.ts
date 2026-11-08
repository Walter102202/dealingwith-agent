import { Hono } from 'hono';
import { DEMO } from '../../db/demo-data.js';
import { listServices } from '../../modules/catalog/catalog.js';
import type { ApiEnv } from '../auth.js';
export function catalogRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/services', async (c) =>
    c.json(await listServices(c.get('deps').db, DEMO.business.id)),
  );
  return app;
}
