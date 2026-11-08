import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { MockPaypalGateway } from '../integrations/paypal/mock.js';
import { createMockPaypalRoutes } from '../integrations/paypal/mock-routes.js';
import type { Deps } from '../workflows/deps.js';
import type { ApiEnv } from './auth.js';
import { onError } from './errors.js';
import { agentRoutes } from './routes/agents.js';
import { catalogRoutes } from './routes/catalog.js';
import { configRoutes } from './routes/config.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { demoRoutes } from './routes/demo.js';
import { eventRoutes } from './routes/events.js';
import { mandateRoutes } from './routes/mandates.js';
import { paymentRoutes } from './routes/payments.js';
import { projectRoutes } from './routes/projects.js';
import { quoteRoutes } from './routes/quotes.js';
import { requestRoutes } from './routes/requests.js';
import { sessionRoutes } from './routes/session.js';
import { webhookRoutes } from './routes/webhooks.js';
import { mountStatic } from './static.js';
export function createApp(deps: Deps): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    const requestId = c.req.header('x-request-id') ?? randomUUID();
    c.header('x-request-id', requestId);
    const start = performance.now();
    await next();
    deps.logger.info('request.completed', {
      requestId,
      method: c.req.method,
      path: c.req.path.replace(/\/mcp\/[^/]+/, '/mcp/[redacted]'),
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
    });
  });
  for (const routes of [
    configRoutes(),
    sessionRoutes(),
    catalogRoutes(),
    projectRoutes(),
    requestRoutes(),
    quoteRoutes(),
    paymentRoutes(),
    mandateRoutes(),
    agentRoutes(),
    eventRoutes(),
    dashboardRoutes(),
    demoRoutes(),
    webhookRoutes(),
  ])
    app.route('/', routes);
  if (deps.env.PAYPAL_MODE === 'mock' && deps.paypal instanceof MockPaypalGateway)
    app.route('/', createMockPaypalRoutes(deps.paypal));
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));
  mountStatic(
    app,
    deps.env.WEB_DIST_DIR ?? fileURLToPath(new URL('../../../web/dist', import.meta.url)),
  );
  return app;
}
