import { ApiRequestError } from '../errors.js';
import { handlers } from './handlers.js';
import { persist } from './state.js';

/** Maps a method and path of Task A7's table to a fixture handler, so `client.ts` needs no knowledge of the fixtures. */

type Body = Record<string, unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  run: (match: RegExpMatchArray, body: Body, query: URLSearchParams) => unknown;
}

const TABLE: Route[] = [
  { method: 'GET', pattern: /^\/healthz$/, run: () => ({ ok: true }) },
  { method: 'GET', pattern: /^\/api\/config$/, run: () => handlers.config() },
  {
    method: 'POST',
    pattern: /^\/api\/session\/login$/,
    run: (_m, b) => handlers.login(b.role as 'client' | 'provider'),
  },
  { method: 'POST', pattern: /^\/api\/session\/logout$/, run: () => handlers.logout() },
  { method: 'GET', pattern: /^\/api\/me$/, run: () => handlers.me() },
  { method: 'GET', pattern: /^\/api\/services$/, run: () => handlers.services() },
  { method: 'GET', pattern: /^\/api\/projects$/, run: () => handlers.projects() },
  {
    method: 'GET',
    pattern: /^\/api\/projects\/([^/]+)$/,
    run: (m) => handlers.getProject(m[1] ?? ''),
  },
  {
    method: 'POST',
    pattern: /^\/api\/projects\/([^/]+)\/requests$/,
    run: (m, b) => handlers.createProjectRequest(m[1] ?? '', b as { text: string }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/requests$/,
    run: (_m, b) => handlers.createRequest(b as { text: string }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/quotes\/([^/]+)$/,
    run: (m, _b, q) => {
      const version = q.get('version');
      return handlers.getQuote(m[1] ?? '', version === null ? undefined : Number(version));
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/quotes\/([^/]+)\/versions$/,
    run: (m) => handlers.quoteVersions(m[1] ?? ''),
  },
  {
    method: 'POST',
    pattern: /^\/api\/quotes\/([^/]+)\/answers$/,
    run: (m, b) => handlers.answerQuote(m[1] ?? '', b as { answers: Record<string, string> }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/quotes\/([^/]+)\/accept$/,
    run: (m, b) => handlers.acceptQuote(m[1] ?? '', b as { version: number }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/paypal\/orders\/([^/]+)\/capture$/,
    run: (m) => handlers.captureOrder(decodeURIComponent(m[1] ?? '')),
  },
  {
    method: 'GET',
    pattern: /^\/api\/payments\/([^/]+)$/,
    run: (m) => handlers.getPayment(m[1] ?? ''),
  },
  {
    method: 'POST',
    pattern: /^\/api\/mandates$/,
    run: (_m, b) => handlers.createMandate(b as Parameters<typeof handlers.createMandate>[0]),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/mandates\/([^/]+)$/,
    run: (m, b) =>
      handlers.updateMandate(m[1] ?? '', b as Parameters<typeof handlers.updateMandate>[1]),
  },
  {
    method: 'POST',
    pattern: /^\/api\/mandates\/([^/]+)\/fund$/,
    run: (m, b) => handlers.fundMandate(m[1] ?? '', b as { fundingAmountCents: number }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/mandates\/([^/]+)\/fund\/complete$/,
    run: (m, b) => handlers.completeFunding(m[1] ?? '', b as { orderId: string }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/mandates\/([^/]+)\/revoke$/,
    run: (m) => handlers.revokeMandate(m[1] ?? ''),
  },
  { method: 'GET', pattern: /^\/api\/agents$/, run: () => handlers.listAgents() },
  {
    method: 'POST',
    pattern: /^\/api\/agents$/,
    run: (_m, b) => handlers.issueAgent(b as { label: string; mandateId?: string }),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/agents\/([^/]+)$/,
    run: (m) => handlers.revokeAgent(m[1] ?? ''),
  },
  { method: 'GET', pattern: /^\/api\/dashboard\/data$/, run: () => handlers.dashboardData() },
  { method: 'POST', pattern: /^\/api\/demo\/reset$/, run: () => handlers.resetDemo() },
];

/** Unknown paths answer 404 like the backend. Every call persists the state for the next page load. */
export async function dispatch(method: string, path: string, body: unknown): Promise<unknown> {
  const url = new URL(path, 'http://fixtures.local');
  for (const route of TABLE) {
    if (route.method !== method) continue;
    const match = url.pathname.match(route.pattern);
    if (match) {
      const result = await route.run(match, (body ?? {}) as Body, url.searchParams);
      persist();
      return result;
    }
  }
  throw new ApiRequestError(404, 'not_found', `No fixture for ${method} ${url.pathname}`);
}
