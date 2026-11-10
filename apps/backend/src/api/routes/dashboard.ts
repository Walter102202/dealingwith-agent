import { AssistantTurnRequestSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { openAssistantTurn } from '../../assistant/turn.js';
import { AppError } from '../../lib/errors.js';
import { buildDashboardData } from '../../modules/dashboard/dashboard.js';
import { type ApiEnv, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';
export function dashboardRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/dashboard/data', requireSession('provider'), async (c) =>
    c.json(
      await buildDashboardData(c.get('deps').db, c.get('session').businessId, c.get('deps').now()),
    ),
  );
  /** One AG Studio chat turn, answered by Claude and streamed back as SSE frames. */
  app.post(
    '/api/dashboard/assistant/turn',
    requireSession('provider'),
    async (c, next) => {
      if (!c.get('deps').assistant)
        throw new AppError('assistant_disabled', 'The assistant is not configured on this server', {
          status: 503,
        });
      await next();
    },
    jsonBody(AssistantTurnRequestSchema),
    async (c) => {
      const deps = c.get('deps');
      const port = deps.assistant;
      if (!port) throw new AppError('assistant_disabled', 'The assistant is not configured');
      // Aborted when the browser goes away, before or during the stream.
      const upstream = new AbortController();
      const abort = () => upstream.abort();
      c.req.raw.signal.addEventListener('abort', abort, { once: true });
      const turn = await openAssistantTurn(port, c.req.valid('json'), {
        signal: upstream.signal,
        logger: deps.logger,
        now: deps.now,
      });
      return streamSSE(c, async (stream) => {
        stream.onAbort(abort);
        try {
          for await (const frame of turn.frames()) {
            if (stream.aborted) break;
            await stream.writeSSE({ event: frame.type, data: JSON.stringify(frame) });
          }
        } finally {
          c.req.raw.signal.removeEventListener('abort', abort);
        }
      });
    },
  );
  return app;
}
