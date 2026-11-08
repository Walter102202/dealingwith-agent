import { ApiErrorSchema } from '@dealingwith/contracts';
import type { ZodType } from 'zod';
import { ApiRequestError } from './errors.js';

export { ApiRequestError, errorMessage } from './errors.js';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** `VITE_API_MODE=fixtures` routes every call to the in-memory demo instead of `fetch`. */
export const FIXTURES_MODE = import.meta.env.VITE_API_MODE === 'fixtures';

async function request<T>(
  method: Method,
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  if (FIXTURES_MODE) {
    const { dispatch } = await import('./fixtures/handlers.js');
    return schema.parse(await dispatch(method, path, body));
  }
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { accept: 'application/json' },
  };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  if (!res.ok) throw await toApiError(res);
  return schema.parse(await res.json());
}

async function toApiError(res: Response): Promise<ApiRequestError> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiRequestError(res.status, code, message, details);
  }
  return new ApiRequestError(res.status, 'http_error', `Request failed with status ${res.status}`);
}

/**
 * The only place the web talks HTTP. Every 2xx body is parsed with its
 * contracts schema, so drift from the API fails loudly at the boundary.
 */
export const api = {
  get: <T>(path: string, schema: ZodType<T>) => request('GET', path, undefined, schema),
  post: <T>(path: string, body: unknown, schema: ZodType<T>) =>
    request('POST', path, body ?? {}, schema),
  patch: <T>(path: string, body: unknown, schema: ZodType<T>) =>
    request('PATCH', path, body, schema),
  del: <T>(path: string, schema: ZodType<T>) => request('DELETE', path, undefined, schema),
};
