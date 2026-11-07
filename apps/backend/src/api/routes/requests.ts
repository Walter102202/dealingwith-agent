import { IdSchema, RequestQuoteInputSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { submitRequest } from '../../workflows/submit-request.js';
import { type ApiEnv, clientId, requireClientOwnsProject, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';

const body = RequestQuoteInputSchema.pick({ text: true });
export function requestRoutes() {
  const app = new Hono<ApiEnv>();
  app.post('/api/projects/:id/requests', requireSession('client'), jsonBody(body), async (c) => {
    const deps = c.get('deps');
    const project = await requireClientOwnsProject(
      deps.db,
      IdSchema.parse(c.req.param('id')),
      c.get('session'),
    );
    return c.json(
      await submitRequest(deps, {
        clientId: clientId(c),
        projectId: project.id,
        channel: 'web',
        text: c.req.valid('json').text,
      }),
    );
  });
  app.post('/api/requests', requireSession('client'), jsonBody(body), async (c) =>
    c.json(
      await submitRequest(c.get('deps'), {
        clientId: clientId(c),
        channel: 'web',
        text: c.req.valid('json').text,
      }),
    ),
  );
  return app;
}
