import { IdSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { type ApiEnv, requireClientOwnsProject, requireSession } from '../auth.js';
import { businessScope } from '../event-scope.js';
import { query } from '../validate.js';
export function eventRoutes() {
  const app = new Hono<ApiEnv>();
  app.get(
    '/api/events',
    requireSession(),
    query(z.object({ projectId: IdSchema.optional() })),
    async (c) => {
      const deps = c.get('deps');
      const { projectId } = c.req.valid('query');
      const session = c.get('session');
      if (!projectId && session.role === 'client')
        throw new AppError('validation_error', 'projectId is required');
      if (projectId) await requireClientOwnsProject(deps.db, projectId, session);
      // Without a project the stream covers the whole business, never other tenants.
      const scope = projectId ? null : businessScope(deps.db, session.businessId);
      return streamSSE(c, async (stream) => {
        await new Promise<void>((resolve) => {
          let writes = Promise.resolve();
          const off = deps.events.subscribe((event) => {
            if (projectId && event.projectId !== projectId) return;
            writes = writes
              .then(async () => {
                if (scope && !(await scope.includes(event))) return;
                await stream.writeSSE({
                  id: event.id,
                  event: event.type,
                  data: JSON.stringify(event),
                });
              })
              .catch(() => {
                stream.abort();
              });
          });
          const heartbeat = setInterval(() => {
            writes = writes
              .then(async () => {
                await stream.write(': heartbeat\n\n');
              })
              .catch(() => {
                stream.abort();
              });
          }, 25000);
          const cleanup = () => {
            off();
            clearInterval(heartbeat);
            c.req.raw.signal.removeEventListener('abort', abort);
            resolve();
          };
          const abort = () => {
            stream.abort();
          };
          stream.onAbort(cleanup);
          c.req.raw.signal.addEventListener('abort', abort, { once: true });
          if (c.req.raw.signal.aborted) abort();
        });
      });
    },
  );
  return app;
}
