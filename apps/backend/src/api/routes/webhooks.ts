import { Hono } from 'hono';
import { processWebhook } from '../../workflows/webhooks.js';
import type { ApiEnv } from '../auth.js';
export function webhookRoutes() {
  const app = new Hono<ApiEnv>();
  app.post('/api/webhooks/paypal', async (c) => {
    const host = c.req.header('host');
    const result = await processWebhook(c.get('deps'), {
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      rawBody: await c.req.text(),
      ...(host ? { host } : {}),
    });
    return c.json(result, result.result === 'invalid_signature' ? 400 : 200);
  });
  return app;
}
