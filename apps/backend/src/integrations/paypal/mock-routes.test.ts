import { describe, expect, test } from 'vitest';
import { MockPaypalGateway } from './mock.js';
import { createMockPaypalRoutes } from './mock-routes.js';

describe('createMockPaypalRoutes', () => {
  test('renders approval, redirects approval and cancellation, and returns 404 for unknown orders', async () => {
    const paypal = new MockPaypalGateway({
      appUrl: 'http://localhost:3000',
      webhookSecret: 'secret',
      deliverWebhook: async () => {},
    });
    const { orderId } = await paypal.createOrder({
      intent: 'CAPTURE',
      amountCents: 8000,
      customId: '<script>bad</script>',
      requestId: 'one',
      returnUrl: 'http://localhost:3000/pay/return',
      cancelUrl: 'http://localhost:3000/pay/cancel',
    });
    const app = createMockPaypalRoutes(paypal);
    const response = await app.request(`/mock-paypal/approve/${orderId}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('US$80.00');
    expect(html).not.toContain('<script>bad</script>');
    const approved = await app.request(`/mock-paypal/approve/${orderId}`, { method: 'POST' });
    expect(approved.status).toBe(303);
    expect(approved.headers.get('location')).toBe(
      `http://localhost:3000/pay/return?token=${orderId}&PayerID=MOCKPAYER01`,
    );
    expect((await app.request(`/mock-paypal/cancel/${orderId}`)).headers.get('location')).toBe(
      `http://localhost:3000/pay/cancel?token=${orderId}`,
    );
    expect((await app.request('/mock-paypal/approve/missing')).status).toBe(404);
  });
});
