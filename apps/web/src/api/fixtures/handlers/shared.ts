import type { Quote } from '@dealingwith/contracts';
import { ApiRequestError } from '../../errors.js';
import { fixtureId } from '../demo-ids.js';
import { matchDemoQuote } from '../quotes.js';
import { CLIENT, nowIso, state } from '../state.js';

export const origin = () =>
  typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;

export const notFound = (what: string) =>
  new ApiRequestError(404, 'not_found', `${what} not found`);
export const pad = (n: number) => String(n).padStart(6, '0');

export const activeAgents = () => state.agents.filter((a) => a.revokedAt === undefined);

export function supersedeOlderVersions(quoteId: string, latestVersion: number): void {
  for (const q of state.quotes) {
    if (q.id === quoteId && q.version < latestVersion && q.status !== 'paid') {
      q.status = 'superseded';
    }
  }
}

export function quoteFromText(
  text: string,
  projectId: string | undefined,
  existing?: { quoteId: string; version: number },
): Quote {
  const template = matchDemoQuote(text);
  if (!template) {
    throw new ApiRequestError(
      422,
      'no_fixture_for_request',
      'The demo agent has no answer for this request. Try one of the five demo requests.',
    );
  }
  const requestId = fixtureId('c', ++state.counters.request);
  state.requests.push({
    id: requestId,
    ...(projectId ? { projectId } : {}),
    clientId: CLIENT.id,
    channel: 'web',
    text,
    status: template.status === 'needs_info' ? 'needs_info' : 'quoted',
    createdAt: nowIso(),
  });
  const quote: Quote = {
    ...structuredClone(template),
    id: existing?.quoteId ?? fixtureId('b', ++state.counters.quote),
    version: existing ? existing.version + 1 : 1,
    requestId,
    ...(projectId ? { projectId } : {}),
  };
  if (!projectId) delete quote.projectId;
  if (quote.status === 'published') quote.publishedAt = nowIso();
  if (existing) supersedeOlderVersions(existing.quoteId, quote.version);
  state.quotes.push(quote);
  return quote;
}

export function latestQuote(quoteId: string): Quote {
  const versions = state.quotes.filter((q) => q.id === quoteId);
  const latest = versions.at(-1);
  if (!latest) throw notFound('Quote');
  return latest;
}

export function appendPaidClauses(quote: Quote): void {
  if (quote.projectId !== state.project.id) return;
  for (const line of quote.lineItems) {
    if (line.kind !== 'rule') continue;
    const already = state.project.scopeClauses.some(
      (c) => c.source.kind === 'quote' && c.source.quoteId === quote.id && c.text === line.label,
    );
    if (already) continue;
    state.project.scopeClauses.push({
      id: `C${state.project.scopeClauses.length + 1}`,
      text: line.label,
      included: true,
      source: { kind: 'quote', quoteId: quote.id, version: quote.version },
    });
  }
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `dwa_${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
