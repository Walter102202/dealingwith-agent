import { CentsSchema, IdSchema, IsoDateTimeSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { getMandate } from '../../modules/mandates/mandates.js';
import {
  completeFunding,
  createMandate,
  revokeMandate,
  startFunding,
  updateMandateLimits,
} from '../../workflows/mandate-funding.js';
import { type ApiEnv, clientId, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';

const limits = z.object({
  perPurchaseLimitCents: CentsSchema,
  totalLimitCents: CentsSchema,
  expiresAt: IsoDateTimeSchema,
});
export function mandateRoutes() {
  const app = new Hono<ApiEnv>();
  app.use('/api/mandates/*', requireSession('client'));
  app.use('/api/mandates', requireSession('client'));
  app.use('/api/mandates/:id/*', async (c, next) => {
    const m = await getMandate(c.get('deps').db, IdSchema.parse(c.req.param('id')));
    if (m.clientId !== clientId(c))
      throw new AppError('forbidden', 'Mandate belongs to another client', { status: 403 });
    await next();
  });
  app.use('/api/mandates/:id', async (c, next) => {
    const m = await getMandate(c.get('deps').db, IdSchema.parse(c.req.param('id')));
    if (m.clientId !== clientId(c))
      throw new AppError('forbidden', 'Mandate belongs to another client', { status: 403 });
    await next();
  });
  app.post('/api/mandates', jsonBody(limits.extend({ projectId: IdSchema })), async (c) =>
    c.json(
      await createMandate(c.get('deps'), { ...c.req.valid('json'), clientId: clientId(c) }),
      201,
    ),
  );
  app.patch('/api/mandates/:id', jsonBody(limits), async (c) =>
    c.json(
      await updateMandateLimits(c.get('deps'), {
        ...c.req.valid('json'),
        mandateId: c.req.param('id'),
      }),
    ),
  );
  app.post(
    '/api/mandates/:id/fund',
    jsonBody(z.object({ fundingAmountCents: CentsSchema.positive() })),
    async (c) =>
      c.json(
        await startFunding(c.get('deps'), {
          mandateId: c.req.param('id'),
          fundingAmountCents: c.req.valid('json').fundingAmountCents,
        }),
      ),
  );
  app.post(
    '/api/mandates/:id/fund/complete',
    jsonBody(z.object({ orderId: z.string().min(1) })),
    async (c) =>
      c.json(
        await completeFunding(c.get('deps'), {
          mandateId: c.req.param('id'),
          orderId: c.req.valid('json').orderId,
        }),
      ),
  );
  app.post('/api/mandates/:id/revoke', async (c) =>
    c.json(await revokeMandate(c.get('deps'), { mandateId: c.req.param('id') })),
  );
  return app;
}
