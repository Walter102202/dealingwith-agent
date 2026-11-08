import { type DashboardData, DashboardDataSchema } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { clients, payments, projects, quotes, requests } from '../../db/schema.js';
import { listServices } from '../catalog/catalog.js';
import { findMandateForProject } from '../mandates/mandates.js';
import { resolveRule } from '../quotes/pricing.js';
export async function buildDashboardData(
  db: Db,
  businessId: string,
  now: Date,
): Promise<DashboardData> {
  const clientRows = await db.select().from(clients).where(eq(clients.businessId, businessId));
  const clientMap = new Map(clientRows.map((c) => [c.id, c]));
  const projectRows = await db.select().from(projects).where(eq(projects.businessId, businessId));
  const projectMap = new Map(projectRows.map((p) => [p.id, p]));
  const requestRows = (await db.select().from(requests)).filter((r) => clientMap.has(r.clientId));
  const requestMap = new Map(requestRows.map((r) => [r.id, r]));
  const quoteRows = (await db.select().from(quotes)).filter((q) => requestMap.has(q.requestId));
  const quoteMap = new Map(quoteRows.map((q) => [`${q.quoteId}:${q.version}`, q]));
  const serviceRows = await listServices(db, businessId);
  const metadata = (requestId: string) => {
    const r = requestMap.get(requestId);
    return {
      clientName: clientMap.get(r?.clientId ?? '')?.name ?? '',
      projectTitle: projectMap.get(r?.projectId ?? '')?.title ?? null,
      channel: r?.channel ?? ('web' as const),
    };
  };
  const project = projectRows[0];
  return DashboardDataSchema.parse({
    quotes: quoteRows.map((q) => ({
      quoteId: q.quoteId,
      version: q.version,
      status: q.status,
      ...metadata(q.requestId),
      requestText: requestMap.get(q.requestId)?.text ?? '',
      includedLines: q.lineItems.filter((l) => l.kind === 'included').length,
      extraLines: q.lineItems.filter((l) => l.kind === 'rule').length,
      totalCents: q.totalCents,
      createdAt: q.createdAt.toISOString(),
      paidAt: q.paidAt?.toISOString() ?? null,
    })),
    lines: quoteRows.flatMap((q) =>
      q.lineItems.map((l) => ({
        quoteId: q.quoteId,
        version: q.version,
        quoteStatus: q.status,
        kind: l.kind,
        label: l.label,
        ruleId: l.kind === 'rule' ? l.ruleRef.id : null,
        serviceName:
          l.kind === 'rule'
            ? (resolveRule(serviceRows, l.ruleRef.id)?.service.name ?? null)
            : (serviceRows.find((s) => s.id === projectMap.get(q.projectId ?? '')?.serviceId)
                ?.name ?? null),
        amountCents: l.amountCents,
        ...metadata(q.requestId),
        createdAt: q.createdAt.toISOString(),
        paidAt: q.paidAt?.toISOString() ?? null,
      })),
    ),
    payments: (await db.select().from(payments))
      .filter((p) => quoteMap.has(`${p.quoteId}:${p.quoteVersion}`))
      .map((p) => {
        const q = quoteMap.get(`${p.quoteId}:${p.quoteVersion}`);
        return {
          paymentId: p.id,
          quoteId: p.quoteId,
          version: p.quoteVersion,
          mode: p.mode,
          status: p.status,
          ...metadata(q?.requestId ?? ''),
          amountCents: p.amountCents,
          createdAt: p.createdAt.toISOString(),
          capturedAt: q?.paidAt?.toISOString() ?? null,
        };
      }),
    requests: requestRows.map((r) => ({
      requestId: r.id,
      ...metadata(r.id),
      status: r.status,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    })),
    services: serviceRows,
    mandate: project
      ? await findMandateForProject(db, { projectId: project.id, clientId: project.clientId })
      : null,
    generatedAt: now.toISOString(),
  });
}
