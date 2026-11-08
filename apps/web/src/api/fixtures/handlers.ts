import type {
  AcceptQuoteResult,
  AppConfig,
  ClientAgent,
  DashboardData,
  IssuedAgent,
  Mandate,
  Payment,
  Project,
  ProjectView,
  Quote,
  Service,
  Session,
} from '@dealingwith/contracts';
import { ApiRequestError } from '../errors.js';
import { dashboardRows } from './dashboard-rows.js';
import { DEMO_IDS, fixtureId } from './demo-ids.js';
import { matchDemoQuote } from './quotes.js';
import { BUSINESS, CLIENT, nowIso, resetState, SERVICES, state } from './state.js';

/**
 * Fixtures mode: the API's behaviour on the demo state, one function per
 * route of Task A7. `dispatch.ts` maps a method and path to these functions.
 */

const origin = () =>
  typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;

const notFound = (what: string) => new ApiRequestError(404, 'not_found', `${what} not found`);
const pad = (n: number) => String(n).padStart(6, '0');

const activeAgents = () => state.agents.filter((a) => a.revokedAt === undefined);

function supersedeOlderVersions(quoteId: string, latestVersion: number): void {
  for (const q of state.quotes) {
    if (q.id === quoteId && q.version < latestVersion && q.status !== 'paid') {
      q.status = 'superseded';
    }
  }
}

function quoteFromText(
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

function latestQuote(quoteId: string): Quote {
  const versions = state.quotes.filter((q) => q.id === quoteId);
  const latest = versions.at(-1);
  if (!latest) throw notFound('Quote');
  return latest;
}

function appendPaidClauses(quote: Quote): void {
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

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `dwa_${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export const handlers = {
  config(): AppConfig {
    return { paypalMode: 'mock', appUrl: origin(), demoMode: true };
  },

  login(role: 'client' | 'provider'): Session {
    state.session =
      role === 'client'
        ? { role, clientId: CLIENT.id, businessId: BUSINESS.id, name: CLIENT.contact }
        : { role, businessId: BUSINESS.id, name: BUSINESS.name };
    return state.session;
  },

  logout(): { ok: true } {
    state.session = null;
    return { ok: true };
  },

  me(): Session {
    if (!state.session) throw new ApiRequestError(401, 'unauthenticated', 'Sign in first');
    return state.session;
  },

  services(): Service[] {
    return SERVICES;
  },

  projects(): Project[] {
    return [state.project];
  },

  async getProject(id: string): Promise<ProjectView> {
    if (id !== state.project.id) throw notFound('Project');
    const service = SERVICES.find((s) => s.id === state.project.serviceId);
    if (!service) throw notFound('Service');
    const quotes = state.quotes
      .filter((q) => q.projectId === id)
      .slice()
      .reverse();
    const quoteIds = new Set(quotes.map((q) => q.id));
    return {
      project: structuredClone(state.project),
      service,
      quotes,
      payments: state.payments.filter((p) => quoteIds.has(p.quoteId)),
      mandate: state.mandate,
      agents: activeAgents(),
    };
  },

  async createProjectRequest(projectId: string, body: { text: string }): Promise<Quote> {
    if (projectId !== state.project.id) throw notFound('Project');
    return quoteFromText(body.text, projectId);
  },

  async createRequest(body: { text: string }): Promise<Quote> {
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

  async acceptQuote(id: string, body: { version: number }): Promise<AcceptQuoteResult> {
    const latest = latestQuote(id);
    if (body.version !== latest.version) {
      return {
        status: 'denied',
        reason: 'stale_version',
        message: `Quote v${body.version} was replaced by v${latest.version}.`,
      };
    }
    if (latest.status === 'paid') {
      const paid = state.payments.find((p) => p.quoteId === id && p.status === 'captured');
      return { status: 'paid', ...(paid ? { payment: paid } : {}) };
    }
    if (latest.status !== 'published' && latest.status !== 'accepted') {
      return {
        status: 'denied',
        reason: 'not_acceptable',
        message: 'This quote still needs your answers before it can be accepted.',
      };
    }
    let payment = state.payments.find((p) => p.quoteId === id && p.quoteVersion === latest.version);
    if (!payment) {
      payment = {
        id: fixtureId('d', ++state.counters.payment),
        quoteId: id,
        quoteVersion: latest.version,
        mode: 'pay_now',
        paypalOrderId: `MOCK-ORDER-${pad(++state.counters.order)}`,
        amountCents: latest.totalCents,
        currency: 'USD',
        status: 'created',
        createdAt: nowIso(),
      };
      state.payments.push(payment);
      latest.status = 'accepted';
      latest.acceptedAt = nowIso();
    }
    if (latest.totalCents === 0)
      return handlers
        .captureOrder(payment.paypalOrderId as string)
        .then((captured) => ({ status: 'paid', payment: captured }));
    return {
      status: 'approval_required',
      approvalUrl: `${origin()}/pay/return?token=${payment.paypalOrderId}`,
      payment,
    };
  },

  async captureOrder(orderId: string): Promise<Payment> {
    const payment = state.payments.find((p) => p.paypalOrderId === orderId);
    if (!payment) throw notFound('Order');
    if (payment.status === 'captured') return payment;
    payment.status = 'captured';
    payment.paypalCaptureId = `MOCK-CAPTURE-${pad(state.payments.filter((p) => p.paypalCaptureId).length + 1)}`;
    const quote = state.quotes.find(
      (q) => q.id === payment.quoteId && q.version === payment.quoteVersion,
    );
    if (quote) {
      quote.status = 'paid';
      quote.paidAt = nowIso();
      appendPaidClauses(quote);
    }
    return payment;
  },

  getPayment(id: string): Payment {
    const payment = state.payments.find((p) => p.id === id);
    if (!payment) throw notFound('Payment');
    return payment;
  },

  createMandate(body: {
    projectId: string;
    perPurchaseLimitCents: number;
    totalLimitCents: number;
    expiresAt: string;
  }): Mandate {
    state.mandate = {
      id: DEMO_IDS.mandate,
      clientId: CLIENT.id,
      businessId: BUSINESS.id,
      projectId: body.projectId,
      perPurchaseLimitCents: body.perPurchaseLimitCents,
      totalLimitCents: body.totalLimitCents,
      spentCents: 0,
      currency: 'USD',
      expiresAt: body.expiresAt,
      status: 'pending',
      funding: { fundingAmountCents: 0, fundingCapturedCents: 0 },
    };
    return state.mandate;
  },

  updateMandate(
    id: string,
    body: { perPurchaseLimitCents: number; totalLimitCents: number; expiresAt: string },
  ): Mandate {
    const mandate = handlers.requireMandate(id);
    Object.assign(mandate, body);
    return mandate;
  },

  fundMandate(
    id: string,
    body: { fundingAmountCents: number },
  ): { approvalUrl: string; orderId: string } {
    const mandate = handlers.requireMandate(id);
    const orderId = `MOCK-ORDER-${pad(++state.counters.order)}`;
    mandate.funding.fundingAmountCents = body.fundingAmountCents;
    return {
      approvalUrl: `${origin()}/portal/mandates/${id}/funded?token=${orderId}`,
      orderId,
    };
  },

  completeFunding(id: string, body: { orderId: string }): Mandate {
    const mandate = handlers.requireMandate(id);
    mandate.status = 'active';
    mandate.funding = {
      paypalAuthorizationId: `MOCK-AUTH-${body.orderId.slice(-6)}`,
      fundingAmountCents: mandate.funding.fundingAmountCents,
      fundingCapturedCents: 0,
      fundingExpiresAt: '2026-12-31T23:59:59.000Z',
    };
    return mandate;
  },

  revokeMandate(id: string): Mandate {
    const mandate = handlers.requireMandate(id);
    mandate.status = 'revoked';
    return mandate;
  },

  requireMandate(id: string): Mandate {
    if (!state.mandate || state.mandate.id !== id) throw notFound('Mandate');
    return state.mandate;
  },

  listAgents(): ClientAgent[] {
    return activeAgents();
  },

  async issueAgent(body: { label: string; mandateId?: string }): Promise<IssuedAgent> {
    const token = randomToken();
    const agent: ClientAgent = {
      id: fixtureId('e', ++state.counters.agent),
      clientId: CLIENT.id,
      label: body.label,
      scopes: ['quote:request', 'quote:accept'],
      ...(body.mandateId ? { mandateId: body.mandateId } : {}),
      createdAt: nowIso(),
    };
    state.agents.push(agent);
    const appUrl = origin();
    return {
      token,
      agent,
      snippets: {
        claudeDesktop: `${appUrl}/mcp/${token}\nAdd this URL as a custom connector in Claude Desktop (Settings → Connectors → Add custom connector). Treat it as a secret: anyone with the link can act as your agent.`,
        claudeCode: `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`,
        cursor: JSON.stringify(
          {
            mcpServers: {
              dealingwith: { url: `${appUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } },
            },
          },
          null,
          2,
        ),
      },
    };
  },

  revokeAgent(id: string): ClientAgent {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw notFound('Agent');
    agent.revokedAt = nowIso();
    return agent;
  },

  dashboardData(): DashboardData {
    return dashboardRows(state);
  },

  resetDemo(): { ok: true } {
    resetState();
    return { ok: true };
  },
};
