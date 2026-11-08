import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createAgentPort } from './agent/port.js';
import { createApp } from './api/app.js';
import { closeDb, createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seedDemo } from './db/seed.js';
import { loadEnv } from './env.js';
import { createPaypalGateway } from './integrations/paypal/index.js';
import { createLogger } from './observability/logger.js';
import type { Deps } from './workflows/deps.js';
import { createEventBus } from './workflows/events.js';
import { processWebhook } from './workflows/webhooks.js';

// `pnpm dev` runs this package from `apps/backend`; the shared `.env` lives at
// the repo root, so the nearest one wins: the cwd, then up to two parents.
const envFile = ['.env', '../.env', '../../.env'].map((p) => resolve(p)).find(existsSync);
if (envFile) process.loadEnvFile(envFile);
const env = loadEnv();
const db = await createDb(env.DATABASE_URL);
await runMigrations(db);
if (env.DEMO_MODE) await seedDemo(db);
const logger = createLogger();
const paypal = createPaypalGateway(env, {
  logger,
  deliverWebhook: async (event, headers) => {
    await processWebhook(deps, { headers, rawBody: JSON.stringify(event) });
  },
});
const deps: Deps = {
  db,
  paypal,
  env,
  logger,
  events: createEventBus(),
  now: () => new Date(),
  agent: createAgentPort(env),
};
const app = createApp(deps);
const server = serve({ fetch: app.fetch, port: env.PORT }, () => {
  logger.info('server.listening', { appUrl: env.APP_URL });
});
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(() => {
    void closeDb(db).then(() => {
      process.exitCode = 0;
    });
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
