import { formatPaypalAmount } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { PaypalError } from './gateway.js';
import type { MockPaypalGateway } from './mock.js';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
export function createMockPaypalRoutes(gateway: MockPaypalGateway): Hono {
  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof PaypalError && error.status === 404)
      return c.html('<h1>Order not found</h1>', 404);
    throw error;
  });
  app.get('/mock-paypal/approve/:orderId', async (c) => {
    const order = await gateway.getOrder(c.req.param('orderId'));
    return c.html(
      `<!doctype html><html lang="en"><head><title>Mock PayPal</title></head><body><h1>Mock PayPal</h1><p>Approve US$${formatPaypalAmount(order.amountCents)}</p><p>${escapeHtml(order.customId)}</p><form method="post" action="/mock-paypal/approve/${escapeHtml(order.orderId)}"><button type="submit">Approve</button></form><a href="/mock-paypal/cancel/${escapeHtml(order.orderId)}">Cancel</a></body></html>`,
    );
  });
  app.post('/mock-paypal/approve/:orderId', async (c) => {
    const orderId = c.req.param('orderId');
    const url = new URL(gateway.redirectUrls(orderId).returnUrl);
    await gateway.approve(orderId);
    url.searchParams.set('token', orderId);
    url.searchParams.set('PayerID', 'MOCKPAYER01');
    return c.redirect(url, 303);
  });
  app.get('/mock-paypal/cancel/:orderId', (c) => {
    const orderId = c.req.param('orderId');
    const url = new URL(gateway.redirectUrls(orderId).cancelUrl);
    url.searchParams.set('token', orderId);
    return c.redirect(url, 303);
  });
  return app;
}
