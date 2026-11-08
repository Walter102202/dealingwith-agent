import { ApiErrorSchema } from '@dealingwith/contracts';
import { ZodError, type ZodType } from 'zod';
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
    const { dispatch } = await import('./fixtures/dispatch.js');
    return parseBody(schema, await dispatch(method, path, body), path);
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
  return parseBody(schema, await res.json(), path);
}

/** Contract drift is logged once, here, where it happens; `errorMessage` stays pure for render paths. */
function parseBody<T>(schema: ZodType<T>, body: unknown, path: string): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) console.error(`Response of ${path} failed its contract`, error);
    throw error;
  }
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
