import { describe, expect, test, vi } from 'vitest';
import { MockPaypalGateway } from './mock.js';

const input = {
  intent: 'CAPTURE' as const,
  amountCents: 8000,
  customId: 'quote:q:1',
  requestId: 'create',
  returnUrl: 'http://localhost:3000/pay/return',
  cancelUrl: 'http://localhost:3000/pay/cancel',
};
const gateway = () =>
  new MockPaypalGateway({
    appUrl: 'http://localhost:3000',
    webhookSecret: 'secret',
    deliverWebhook: vi.fn(async () => {}),
  });
describe('MockPaypalGateway', () => {
  test('creates, approves and captures once with stable idempotency results', async () => {
    const paypal = gateway();
    const order = await paypal.createOrder(input);
    expect(await paypal.createOrder(input)).toEqual(order);
    expect(order.orderId).toBe('MOCK-ORDER-000001');
    await expect(paypal.captureOrder(order.orderId, 'capture')).rejects.toMatchObject({
      code: 'ORDER_NOT_APPROVED',
    });
    await paypal.approve(order.orderId);
    const result = await paypal.captureOrder(order.orderId, 'capture');
    expect(result).toMatchObject({ status: 'COMPLETED', amountCents: 8000 });
    expect(await paypal.captureOrder(order.orderId, 'capture')).toEqual(result);
    await expect(paypal.captureOrder(order.orderId, 'different')).rejects.toMatchObject({
      code: 'ORDER_ALREADY_CAPTURED',
    });
    expect(await paypal.getOrder(order.orderId)).toMatchObject({ status: 'COMPLETED' });
    expect(
      paypal.events().filter((e) => e.event_type === 'PAYMENT.CAPTURE.COMPLETED'),
    ).toMatchObject([
      { resource: { supplementary_data: { related_ids: { order_id: order.orderId } } } },
    ]);
  });
  test('authorizes and partially captures without exceeding the authorization', async () => {
    const paypal = gateway();
    const order = await paypal.createOrder({ ...input, intent: 'AUTHORIZE', amountCents: 200000 });
    await paypal.approve(order.orderId);
    const auth = await paypal.authorizeOrder(order.orderId, 'authorize');
    expect(auth.expiresAt).toBeNull();
    for (const requestId of ['one', 'two'])
      await paypal.captureAuthorization(auth.authorizationId, {
        amountCents: 6000,
        finalCapture: false,
        requestId,
        invoiceId: `mandate:quote:${requestId}`,
      });
    await expect(
      paypal.captureAuthorization(auth.authorizationId, {
        amountCents: 190000,
        finalCapture: false,
        requestId: 'three',
        invoiceId: 'mandate:quote:three',
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_AMOUNT_EXCEEDED' });
    expect(
      paypal.events().filter((e) => e.event_type === 'PAYMENT.CAPTURE.COMPLETED'),
    ).toMatchObject([
      {
        resource: {
          invoice_id: 'mandate:quote:one',
          supplementary_data: { related_ids: { authorization_id: auth.authorizationId } },
        },
      },
      {
        resource: {
          invoice_id: 'mandate:quote:two',
          supplementary_data: { related_ids: { authorization_id: auth.authorizationId } },
        },
      },
    ]);
  });
  test('verifies headers case-insensitively and tolerates failed delivery', async () => {
    const paypal = new MockPaypalGateway({
      appUrl: 'http://localhost:3000',
      webhookSecret: 'secret',
      deliverWebhook: async () => {
        throw new Error('offline');
      },
    });
    expect(await paypal.verifyWebhookSignature({ 'X-Mock-Signature': 'secret' }, '')).toEqual({
      ok: true,
    });
    expect(await paypal.verifyWebhookSignature({}, '')).toEqual({
      ok: false,
      reason: 'verification_failed',
    });
    const order = await paypal.createOrder(input);
    await paypal.approve(order.orderId);
    expect(await paypal.captureOrder(order.orderId, 'capture')).toMatchObject({
      status: 'COMPLETED',
    });
  });
});
