import { IdSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { notFound } from '../../lib/errors.js';
import { findPaymentByOrderId, getPayment } from '../../modules/payments/payments.js';
import { captureApprovedOrder } from '../../workflows/capture.js';
import { type ApiEnv, requireOwnsQuote, requireSession } from '../auth.js';
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
  app.post('/api/paypal/orders/:orderId/capture', requireSession('client'), async (c) => {
    const deps = c.get('deps');
    const orderId = c.req.param('orderId');
    const p = await findPaymentByOrderId(deps.db, orderId);
    if (!p) throw notFound('payment', orderId);
    await requireOwnsQuote(deps.db, p.quoteId, c.get('session'), p.quoteVersion);
    return c.json(await captureApprovedOrder(deps, { orderId }));
  });
  return app;
}
