import { expect, it, vi } from 'vitest';
import { SandboxPaypalGateway } from './sandbox.js';

const input = {
  intent: 'CAPTURE' as const,
  amountCents: 6000,
  customId: 'quote:q:1',
  requestId: 'request-1',
  returnUrl: 'https://example.com/return',
  cancelUrl: 'https://example.com/cancel',
};
const amount = { currency_code: 'USD', value: '60.00' };
const capture = { id: 'capture-1', status: 'COMPLETED', amount };
function setup(body: unknown, status = 200, webhookId = 'webhook-1') {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (url) =>
      String(url).endsWith('/v1/oauth2/token')
        ? Response.json({ access_token: 'token', expires_in: 3600 })
        : Response.json(body, { status }),
    );
  const gateway = new SandboxPaypalGateway({
    clientId: 'client',
    clientSecret: 'secret',
    webhookId,
    fetch,
  });
  const request = () => {
    const call = fetch.mock.calls.at(-1);
    return { url: call?.[0], ...call?.[1], body: JSON.parse(String(call?.[1]?.body ?? '{}')) };
  };
  return { gateway, fetch, request };
}

it.each(['payer-action', 'approve'])(
  'creates orders with idempotency and the %s approval link',
  async (rel) => {
    const { gateway, request } = setup({
      id: 'order-1',
      links: [{ rel, href: 'https://www.sandbox.paypal.com/approve' }],
    });
    expect(await gateway.createOrder(input)).toMatchObject({
      orderId: 'order-1',
      approveUrl: 'https://www.sandbox.paypal.com/approve',
    });
    expect(request()).toMatchObject({
      url: 'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      method: 'POST',
      headers: expect.objectContaining({ 'PayPal-Request-Id': input.requestId }),
      body: {
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: 'default', custom_id: input.customId, amount }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'DealingWith Agent',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
    });
  },
);
it('prefers payer-action and rejects missing approval links', async () => {
  const { gateway } = setup({
    id: 'o',
    links: [
      { rel: 'approve', href: 'fallback' },
      { rel: 'payer-action', href: 'preferred' },
    ],
  });
  expect((await gateway.createOrder(input)).approveUrl).toBe('preferred');
  await expect(setup({ id: 'o', links: [] }).gateway.createOrder(input)).rejects.toMatchObject({
    code: 'APPROVE_LINK_MISSING',
    status: 502,
  });
});
it('reads order payment ids and maps PAYER_ACTION_REQUIRED to CREATED', async () => {
  const { gateway } = setup({
    id: 'o',
    intent: 'CAPTURE',
    status: 'PAYER_ACTION_REQUIRED',
    purchase_units: [
      {
        amount,
        custom_id: 'quote:q:1',
        payments: { captures: [capture], authorizations: [{ id: 'auth-1' }] },
      },
    ],
  });
  expect(await gateway.getOrder('o')).toMatchObject({
    orderId: 'o',
    intent: 'CAPTURE',
    status: 'CREATED',
    amountCents: 6000,
    customId: 'quote:q:1',
    captureId: 'capture-1',
    authorizationId: 'auth-1',
  });
});
it.each(['COMPLETED', 'PENDING', 'DECLINED', 'FAILED'])(
  'captures an order with status %s',
  async (status) => {
    const { gateway, request } = setup({
      purchase_units: [{ payments: { captures: [{ ...capture, status }] } }],
    });
    expect(await gateway.captureOrder('o', 'capture-key')).toMatchObject({
      captureId: 'capture-1',
      amountCents: 6000,
      status: status === 'FAILED' ? 'DECLINED' : status,
    });
    expect(request()).toMatchObject({
      url: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/o/capture',
      headers: expect.objectContaining({ 'PayPal-Request-Id': 'capture-key' }),
    });
  },
);
it('authorizes an order and preserves expiration_time', async () => {
  const { gateway, request } = setup({
    purchase_units: [
      {
        payments: {
          authorizations: [
            { id: 'auth-1', status: 'CREATED', amount, expiration_time: '2026-12-07T00:00:00Z' },
          ],
        },
      },
    ],
  });
  expect(await gateway.authorizeOrder('o', 'auth-key')).toMatchObject({
    authorizationId: 'auth-1',
    amountCents: 6000,
    expiresAt: '2026-12-07T00:00:00Z',
  });
  expect(request()).toMatchObject({
    url: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/o/authorize',
    headers: expect.objectContaining({ 'PayPal-Request-Id': 'auth-key' }),
  });
});
it('partially captures one dollar with the invoice and idempotency keys', async () => {
  const { gateway, request } = setup({
    ...capture,
    amount: { currency_code: 'USD', value: '1.00' },
  });
  expect(
    await gateway.captureAuthorization('a', {
      amountCents: 100,
      finalCapture: false,
      requestId: 'partial-key',
      invoiceId: 'mandate:q:1',
    }),
  ).toMatchObject({ amountCents: 100, status: 'COMPLETED' });
  expect(request()).toMatchObject({
    url: 'https://api-m.sandbox.paypal.com/v2/payments/authorizations/a/capture',
    headers: expect.objectContaining({ 'PayPal-Request-Id': 'partial-key' }),
    body: {
      amount: { currency_code: 'USD', value: '1.00' },
      final_capture: false,
      invoice_id: 'mandate:q:1',
    },
  });
});
it('preserves PayPal issue codes and HTTP status', async () => {
  const { gateway } = setup(
    { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'AUTHORIZATION_AMOUNT_EXCEEDED' }] },
    422,
  );
  await expect(
    gateway.captureAuthorization('a', {
      amountCents: 100,
      finalCapture: false,
      requestId: 'key',
      invoiceId: 'invoice',
    }),
  ).rejects.toMatchObject({ code: 'AUTHORIZATION_AMOUNT_EXCEEDED', status: 422 });
});
const headers = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
  'paypal-transmission-id': 'transmission',
  'paypal-transmission-sig': 'signature',
  'paypal-transmission-time': '2026-11-08T00:00:00Z',
};
it.each(['SUCCESS', 'FAILURE'])('verifies the seven webhook fields for %s', async (status) => {
  const { gateway, request } = setup({ verification_status: status });
  expect(await gateway.verifyWebhookSignature(headers, '{"id":"event"}')).toBe(
    status === 'SUCCESS',
  );
  expect(request()).toMatchObject({
    url: 'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
    body: {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: 'webhook-1',
      webhook_event: { id: 'event' },
    },
  });
});
it('accepts case-insensitive webhook headers', async () => {
  expect(
    await setup({ verification_status: 'SUCCESS' }).gateway.verifyWebhookSignature(
      Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toUpperCase(), value])),
      '{}',
    ),
  ).toBe(true);
});
it('rejects missing signature or webhook id without fetching', async () => {
  const { gateway, fetch } = setup({});
  const { 'paypal-transmission-sig': _, ...missing } = headers;
  expect(await gateway.verifyWebhookSignature(missing, '{}')).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  const absent = setup({}, 200, '');
  expect(await absent.gateway.verifyWebhookSignature(headers, '{}')).toBe(false);
  expect(absent.fetch).not.toHaveBeenCalled();
});

it.each(['DENIED', 'PENDING'])(
  'rejects an HTTP 201 authorization with status %s',
  async (status) => {
    const { gateway } = setup(
      { purchase_units: [{ payments: { authorizations: [{ id: 'auth', amount, status }] } }] },
      201,
    );
    await expect(gateway.authorizeOrder('o', 'key')).rejects.toMatchObject({
      code: status,
      status: 502,
    });
  },
);
it.each([false, true])(
  'only returns a completed capture id (completed present: %s)',
  async (completed) => {
    const { gateway } = setup({
      id: 'o',
      intent: 'CAPTURE',
      status: 'COMPLETED',
      purchase_units: [
        {
          amount,
          custom_id: 'q',
          payments: {
            captures: [
              { ...capture, id: 'pending', status: 'PENDING' },
              ...(completed ? [capture] : []),
            ],
          },
        },
      ],
    });
    const result = await gateway.getOrder('o');
    if (completed) expect(result.captureId).toBe('capture-1');
    else expect(result).not.toHaveProperty('captureId');
  },
);
it.each([false, true])(
  'refreshes a rejected token once and preserves idempotency (second rejection: %s)',
  async (rejectAgain) => {
    let tokens = 0;
    let calls = 0;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/oauth2/token'))
        return Response.json({ access_token: `token-${++tokens}`, expires_in: 3600 });
      calls++;
      return calls === 1 || rejectAgain
        ? Response.json({ name: 'AUTHENTICATION_FAILURE' }, { status: 401 })
        : Response.json({ purchase_units: [{ payments: { captures: [capture] } }] });
    });
    const gateway = new SandboxPaypalGateway({ clientId: 'client', clientSecret: 'secret', fetch });
    const result = gateway.captureOrder('o', 'same-key');
    if (rejectAgain)
      await expect(result).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILURE', status: 503 });
    else expect(await result).toMatchObject({ captureId: 'capture-1', status: 'COMPLETED' });
    expect(tokens).toBe(2);
    const requests = fetch.mock.calls.filter(([url]) => !String(url).endsWith('/v1/oauth2/token'));
    expect(requests).toHaveLength(2);
    for (const [index, request] of requests.entries()) {
      expect(request[1]).toMatchObject({
        headers: expect.objectContaining({
          Authorization: `Bearer token-${index + 1}`,
          'PayPal-Request-Id': 'same-key',
        }),
        body: '{}',
      });
    }
    if (!rejectAgain) {
      await gateway.captureOrder('o', 'another-key');
      expect(tokens).toBe(2);
    }
  },
);
it('does not retry a rejected token endpoint', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ name: 'invalid_client' }, { status: 401 }));
  const gateway = new SandboxPaypalGateway({ clientId: 'client', clientSecret: 'secret', fetch });
  await expect(gateway.captureOrder('o', 'key')).rejects.toMatchObject({
    code: 'invalid_client',
    status: 503,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
