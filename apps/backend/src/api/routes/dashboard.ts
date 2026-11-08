import { Hono } from 'hono';
import { buildDashboardData } from '../../modules/dashboard/dashboard.js';
import { type ApiEnv, requireSession } from '../auth.js';
export function dashboardRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/dashboard/data', requireSession('provider'), async (c) =>
    c.json(
      await buildDashboardData(c.get('deps').db, c.get('session').businessId, c.get('deps').now()),
    ),
  );
  return app;
}
