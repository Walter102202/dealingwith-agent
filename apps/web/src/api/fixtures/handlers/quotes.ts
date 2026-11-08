import type { Quote } from '@dealingwith/contracts';
import { state } from '../state.js';
import { latestQuote, notFound, quoteFromText } from './shared.js';

export const quotesHandlers = {
  async createProjectRequest(projectId: string, body: { text: string }): Promise<Quote> {
    if (projectId !== state.project.id) throw notFound('Project');
    return quoteFromText(body.text, projectId);
  },

  /** `serviceId` is accepted as the API does; the fixture prices `Buy <service>` from the text. */
  async createRequest(body: { text: string; serviceId?: string }): Promise<Quote> {
    return quoteFromText(body.text, undefined);
  },

  getQuote(id: string, version?: number): Quote {
    if (version === undefined) return latestQuote(id);
    const quote = state.quotes.find((q) => q.id === id && q.version === version);
    if (!quote) throw notFound('Quote');
    return quote;
  },

  quoteVersions(id: string): Quote[] {
    const versions = state.quotes.filter((q) => q.id === id);
    if (versions.length === 0) throw notFound('Quote');
    return versions;
  },

  answerQuote(id: string, body: { answers: Record<string, string> }): Quote {
    const latest = latestQuote(id);
    const request = state.requests.find((r) => r.id === latest.requestId);
    const text = Object.values(body.answers).join(' ');
    const projectId = latest.projectId;
    const quote = quoteFromText(text, projectId, { quoteId: id, version: latest.version });
    if (request) request.status = quote.status === 'needs_info' ? 'needs_info' : 'quoted';
    return quote;
  },
};
