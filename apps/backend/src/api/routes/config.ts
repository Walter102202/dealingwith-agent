import { Hono } from 'hono';
import type { ApiEnv } from '../auth.js';
export function configRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.get('/api/config', (c) => {
    const env = c.get('deps').env;
    return c.json({
      paypalMode: env.PAYPAL_MODE,
      ...(env.PAYPAL_MODE === 'sandbox' ? { paypalClientId: env.PAYPAL_CLIENT_ID } : {}),
      appUrl: env.APP_URL,
      demoMode: env.DEMO_MODE,
    });
  });
  return app;
}
