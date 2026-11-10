import { AssistantTurnRequestSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { openAssistantTurn } from '../../assistant/turn.js';
import { AppError } from '../../lib/errors.js';
import { buildDashboardData } from '../../modules/dashboard/dashboard.js';
import { type ApiEnv, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';

/**
 * A Studio turn is tens of kilobytes. The cap bounds what one request can make
 * Claude read, because the daily cap counts turns, not tokens.
 */
export const ASSISTANT_MAX_BODY_BYTES = 1024 * 1024;

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
    bodyLimit({
      maxSize: ASSISTANT_MAX_BODY_BYTES,
      onError: () => {
        throw new AppError(
          'assistant_request_too_large',
          'This conversation is too long for the assistant. Start a new conversation.',
          { status: 413 },
        );
      },
    }),
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
