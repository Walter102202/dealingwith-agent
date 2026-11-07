import { IdSchema, ProjectViewSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { listAgents } from '../../access/agent-tokens.js';
import { getService } from '../../modules/catalog/catalog.js';
import { findMandateForProject } from '../../modules/mandates/mandates.js';
import { listPaymentsForProject } from '../../modules/payments/payments.js';
import { listQuotesForProject } from '../../modules/quotes/quotes.js';
import { type ApiEnv, requireClientOwnsProject, requireSession } from '../auth.js';
export function projectRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/projects/:id', requireSession(), async (c) => {
    const db = c.get('deps').db;
    const project = await requireClientOwnsProject(
      db,
      IdSchema.parse(c.req.param('id')),
      c.get('session'),
    );
    return c.json(
      ProjectViewSchema.parse({
        project,
        service: await getService(db, project.serviceId),
        quotes: await listQuotesForProject(db, project.id),
        payments: await listPaymentsForProject(db, project.id),
        mandate: await findMandateForProject(db, {
          projectId: project.id,
          clientId: project.clientId,
        }),
        agents: await listAgents(db, project.clientId),
      }),
    );
  });
  return app;
}
