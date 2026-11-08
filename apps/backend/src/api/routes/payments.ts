import { IdSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { AppError, notFound } from '../../lib/errors.js';
import { findPaymentByOrderId, getPayment } from '../../modules/payments/payments.js';
import { captureApprovedOrder } from '../../workflows/capture.js';
import { type ApiEnv, readSession, requireOwnsQuote, requireSession } from '../auth.js';
export function paymentRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/payments/:id', requireSession(), async (c) => {
    const payment = await getPayment(c.get('deps').db, IdSchema.parse(c.req.param('id')));
    await requireOwnsQuote(
      c.get('deps').db,
      payment.quoteId,
      c.get('session'),
      payment.quoteVersion,
    );
    return c.json(payment);
  });
  app.post('/api/paypal/orders/:orderId/capture', async (c) => {
    const deps = c.get('deps');
    const orderId = c.req.param('orderId');
    const p = await findPaymentByOrderId(deps.db, orderId);
    if (!p) throw notFound('payment', orderId);
    if (p.mode !== 'pay_now')
      throw new AppError('forbidden', 'Only pay-now orders can be captured here', { status: 403 });
    const session = readSession(c, deps.env, deps.now());
    if (session) await requireOwnsQuote(deps.db, p.quoteId, session, p.quoteVersion);
    return c.json(await captureApprovedOrder(deps, { orderId }));
  });
  return app;
}
