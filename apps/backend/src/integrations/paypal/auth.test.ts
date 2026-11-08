import { expect, it, vi } from 'vitest';
import { createTokenSource } from './auth.js';

it('caches tokens until sixty seconds before expiry and refreshes after expiry', async () => {
  let now = 0;
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () =>
      Response.json({ access_token: `token-${fetch.mock.calls.length}`, expires_in: 120 }),
    );
  const source = createTokenSource({
    clientId: 'client',
    clientSecret: 'secret',
    fetch,
    now: () => now,
  });
  expect(await source.getAccessToken()).toBe('token-1');
  now = 59_000;
  expect(await source.getAccessToken()).toBe('token-1');
  expect(fetch).toHaveBeenCalledTimes(1);
  now = 60_000;
  expect(await source.getAccessToken()).toBe('token-2');
  now = 181_000;
  expect(await source.getAccessToken()).toBe('token-3');
  expect(fetch.mock.calls[0]).toEqual([
    'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    expect.objectContaining({
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from('client:secret').toString('base64')}`,
      }),
    }),
  ]);
});
