import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { ApiRequestError, api } from './client.js';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a ZodError when a 2xx body does not match the schema and logs it once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { totalCents: 'eighty' })),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        api.get('/api/quotes/x', z.object({ totalCents: z.number() })),
      ).rejects.toBeInstanceOf(ZodError);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]?.[0]).toBe('Response of /api/quotes/x failed its contract');
    } finally {
      log.mockRestore();
    }
  });

  it('throws ApiRequestError with status, code and message on a non-2xx envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(404, { error: { code: 'not_found', message: 'Quote not found' } }),
      ),
    );
    const failure = await api.get('/api/quotes/x', z.object({})).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiRequestError);
    const error = failure as ApiRequestError;
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(error.message).toBe('Quote not found');
  });

  it('sends JSON bodies with credentials and parses the response', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await api.post(
      '/api/session/login',
      { role: 'client' },
      z.object({ ok: z.boolean() }),
    );
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/session/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ role: 'client' }));
  });
});
