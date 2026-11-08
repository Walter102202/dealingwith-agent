import { type AgentOutput, AgentOutputSchema, ContextPackSchema } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { agentRuns, businesses, clients } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { listServices } from '../modules/catalog/catalog.js';
import { findMandateForProject, remainingCents } from '../modules/mandates/mandates.js';
import { getProject } from '../modules/projects/projects.js';
import { listQuotesForProject } from '../modules/quotes/quotes.js';
import { DEMO_AGENT_OUTPUTS } from './demo-agent-outputs.js';
import type { AgentPort } from './deps.js';
export function fakeAgentPort(
  outputs: Record<string, AgentOutput> = DEMO_AGENT_OUTPUTS,
): AgentPort {
  return {
    async buildContextPack(db, input) {
      const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId));
      if (!client) throw notFound('client', input.clientId);
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, client.businessId));
      if (!business) throw notFound('business', client.businessId);
      const project = input.projectId ? await getProject(db, input.projectId) : null;
      if (project && project.clientId !== input.clientId)
        throw new AppError('forbidden', 'Project belongs to another client', { status: 403 });
      const priorQuotes = project ? await listQuotesForProject(db, project.id) : [];
      const mandate = project
        ? await findMandateForProject(db, { projectId: project.id, clientId: input.clientId })
        : null;
      return ContextPackSchema.parse({
        business: { name: business.name, currency: business.currency },
        services: await listServices(db, business.id),
        project,
        priorQuotes: priorQuotes.map((q) => ({
          quoteId: q.id,
          version: q.version,
          status: q.status,
          lineItems: q.lineItems,
        })),
        mandate: mandate
          ? {
              perPurchaseLimitCents: mandate.perPurchaseLimitCents,
              remainingCents: remainingCents(mandate),
            }
          : null,
        openQuestions: priorQuotes
          .filter((q) => q.status === 'needs_info')
          .flatMap((q) => q.needsInfo.map((n) => ({ quoteId: q.id, question: n.question }))),
      });
    },
    async runAgent(deps, input) {
      const text = (
        input.answers ? Object.values(input.answers).join(' ') : input.text
      ).toLowerCase();
      const match = Object.entries(outputs).find(([key]) => text.includes(key.toLowerCase()));
      const output = AgentOutputSchema.parse(
        match
          ? structuredClone(match[1])
          : {
              lineItems: [],
              needsInfo: [
                {
                  question: 'This demo understands five scripted requests; which one do you mean?',
                  whyItChangesPrice: 'The price depends on which service or clause applies.',
                },
              ],
              explanation: 'Choose a scripted request or clarify the work you need.',
              deliveryDays: 0,
              confidence: 0,
            },
      );
      const [run] = await deps.db
        .insert(agentRuns)
        .values({
          requestId: input.requestId,
          provider: 'mock',
          model: 'demo-fixtures',
          promptVersion: 'fixtures-v1',
          outcome: 'ok',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
        })
        .returning();
      if (!run)
        throw new AppError('agent_run_not_created', 'Agent run could not be recorded', {
          status: 500,
        });
      return { output, runId: run.id };
    },
  };
}
