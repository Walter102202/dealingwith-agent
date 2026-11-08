import {
  AcceptQuoteInputSchema,
  AnswerQuestionsInputSchema,
  IdSchema,
} from '@dealingwith/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import { listQuoteVersions } from '../../modules/quotes/quotes.js';
import { acceptQuote } from '../../workflows/accept-quote.js';
import { submitRequest } from '../../workflows/submit-request.js';
import { type ApiEnv, clientId, requireOwnsQuote, requireSession } from '../auth.js';
import { jsonBody, query } from '../validate.js';
export function quoteRoutes() {
  const app = new Hono<ApiEnv>();
  app.get(
    '/api/quotes/:id',
    requireSession(),
    query(z.object({ version: z.coerce.number().int().positive().optional() })),
    async (c) =>
      c.json(
        await requireOwnsQuote(
          c.get('deps').db,
          IdSchema.parse(c.req.param('id')),
          c.get('session'),
          c.req.valid('query').version,
        ),
      ),
  );
  app.get('/api/quotes/:id/versions', requireSession(), async (c) => {
    const db = c.get('deps').db;
    const q = await requireOwnsQuote(db, IdSchema.parse(c.req.param('id')), c.get('session'));
    return c.json(await listQuoteVersions(db, q.id));
  });
  app.post(
    '/api/quotes/:id/answers',
    requireSession('client'),
    jsonBody(AnswerQuestionsInputSchema.pick({ answers: true })),
    async (c) => {
      const q = await requireOwnsQuote(
        c.get('deps').db,
        IdSchema.parse(c.req.param('id')),
        c.get('session'),
      );
      return c.json(
        await submitRequest(c.get('deps'), {
          quoteId: q.id,
          answers: c.req.valid('json').answers,
          clientId: clientId(c),
          channel: 'web',
        }),
      );
    },
  );
  app.post(
    '/api/quotes/:id/accept',
    requireSession('client'),
    jsonBody(AcceptQuoteInputSchema.pick({ version: true })),
    async (c) =>
      c.json(
        await acceptQuote(c.get('deps'), {
          quoteId: IdSchema.parse(c.req.param('id')),
          version: c.req.valid('json').version,
          actor: { kind: 'web', clientId: clientId(c) },
        }),
      ),
  );
  return app;
}
