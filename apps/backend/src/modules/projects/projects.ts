import { type Project, ProjectSchema, type Quote, type ScopeClause } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { projects } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
export function toProject(row: typeof projects.$inferSelect): Project {
  return ProjectSchema.parse(row);
}
export async function getProject(db: Db, projectId: string): Promise<Project> {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!row) throw notFound('project', projectId);
  return toProject(row);
}
export async function listProjectsForClient(db: Db, clientId: string): Promise<Project[]> {
  return (await db.select().from(projects).where(eq(projects.clientId, clientId))).map(toProject);
}
export async function listProjectsForBusiness(db: Db, businessId: string): Promise<Project[]> {
  return (await db.select().from(projects).where(eq(projects.businessId, businessId))).map(
    toProject,
  );
}
export async function appendPaidClauses(
  db: Db,
  projectId: string,
  quote: Quote,
): Promise<ScopeClause[]> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
    if (!row) throw notFound('project', projectId);
    if (
      row.scopeClauses.some(
        ({ source }) =>
          source.kind === 'quote' &&
          source.quoteId === quote.id &&
          source.version === quote.version,
      )
    )
      return [];
    let suffix = row.scopeClauses.reduce(
      (max, clause) => Math.max(max, Number(/^C(\d+)$/.exec(clause.id)?.[1] ?? 0)),
      0,
    );
    const appended: ScopeClause[] = quote.lineItems
      .filter((line) => line.kind === 'rule')
      .map((line) => ({
        id: `C${++suffix}`,
        text: line.label,
        included: true,
        source: { kind: 'quote', quoteId: quote.id, version: quote.version },
      }));
    if (appended.length)
      await tx
        .update(projects)
        .set({ scopeClauses: [...row.scopeClauses, ...appended] })
        .where(eq(projects.id, projectId));
    return appended;
  });
}
