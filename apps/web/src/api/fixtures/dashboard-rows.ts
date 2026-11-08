import type {
  DashboardData,
  DashboardLineRow,
  DashboardPaymentRow,
  DashboardQuoteRow,
  DashboardRequestRow,
} from '@dealingwith/contracts';
import { CLIENT, type FixtureState, nowIso, SERVICES } from './state.js';

/** Derives the provider dashboard rows from the fixture state, as `buildDashboardData` does. */
export function dashboardRows(s: FixtureState): DashboardData {
  const requestById = new Map(s.requests.map((r) => [r.id, r]));
  const projectTitle = (projectId?: string) =>
    projectId === s.project.id ? s.project.title : null;
  const serviceOfRule = (ruleId: string) =>
    SERVICES.find((svc) => svc.pricingRules.some((r) => r.id === ruleId))?.name ?? null;
  const projectService = SERVICES.find((svc) => svc.id === s.project.serviceId)?.name ?? null;

  const quotes: DashboardQuoteRow[] = s.quotes.map((q) => {
    const request = requestById.get(q.requestId);
    return {
      quoteId: q.id,
      version: q.version,
      status: q.status,
      channel: request?.channel ?? 'web',
      requestText: request?.text ?? '',
      clientName: CLIENT.name,
      projectTitle: projectTitle(q.projectId),
      includedLines: q.lineItems.filter((l) => l.kind === 'included').length,
      extraLines: q.lineItems.filter((l) => l.kind === 'rule').length,
      totalCents: q.totalCents,
      createdAt: request?.createdAt ?? q.publishedAt ?? nowIso(),
      paidAt: q.paidAt ?? null,
    };
  });

  const lines: DashboardLineRow[] = s.quotes.flatMap((q) => {
    const request = requestById.get(q.requestId);
    return q.lineItems.map((l) => ({
      quoteId: q.id,
      version: q.version,
      quoteStatus: q.status,
      kind: l.kind,
      label: l.label,
      ruleId: l.kind === 'rule' ? l.ruleRef.id : null,
      serviceName: l.kind === 'rule' ? serviceOfRule(l.ruleRef.id) : projectService,
      amountCents: l.amountCents,
      clientName: CLIENT.name,
      projectTitle: projectTitle(q.projectId),
      channel: request?.channel ?? 'web',
      createdAt: request?.createdAt ?? q.publishedAt ?? nowIso(),
      paidAt: q.paidAt ?? null,
    }));
  });

  const payments: DashboardPaymentRow[] = s.payments.map((p) => {
    const quote = s.quotes.find((q) => q.id === p.quoteId);
    return {
      paymentId: p.id,
      quoteId: p.quoteId,
      version: p.quoteVersion,
      mode: p.mode,
      status: p.status,
      clientName: CLIENT.name,
      projectTitle: projectTitle(quote?.projectId),
      amountCents: p.amountCents,
      createdAt: p.createdAt,
      capturedAt: p.status === 'captured' ? (quote?.paidAt ?? p.createdAt) : null,
    };
  });

  const requests: DashboardRequestRow[] = s.requests.map((r) => ({
    requestId: r.id,
    channel: r.channel,
    status: r.status,
    clientName: CLIENT.name,
    projectTitle: projectTitle(r.projectId),
    text: r.text,
    createdAt: r.createdAt,
  }));

  return {
    quotes,
    lines,
    payments,
    requests,
    services: SERVICES,
    mandate: s.mandate,
    generatedAt: nowIso(),
  };
}
