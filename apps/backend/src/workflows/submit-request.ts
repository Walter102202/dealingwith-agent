import type { AgentOutput, Quote, RequestChannel } from '@dealingwith/contracts';
import { AgentRunError } from '../agent/run.js';
import { AppError } from '../lib/errors.js';
import { getService } from '../modules/catalog/catalog.js';
import { getClient } from '../modules/clients/clients.js';
import { getProject } from '../modules/projects/projects.js';
import { PricingError } from '../modules/quotes/errors.js';
import { type PricedQuote, priceIntents } from '../modules/quotes/pricing.js';
import { createQuoteVersion, getQuote } from '../modules/quotes/quotes.js';
import { createRequest, getRequest, setRequestStatus } from '../modules/requests/requests.js';
import type { Deps } from './deps.js';
import { makeEvent } from './events.js';

type SubmitInput =
  | {
      clientId: string;
      projectId?: string;
      channel: RequestChannel;
      agentId?: string;
      text: string;
      serviceId?: string;
    }
  | {
      quoteId: string;
      answers: Record<string, string>;
      clientId: string;
      channel: RequestChannel;
      agentId?: string;
    };
async function runPricedAgent(deps: Deps, input: Parameters<Deps['agent']['runAgent']>[1]) {
  let text = input.text;
  for (let attempt = 0; ; attempt++) {
    const run = await deps.agent.runAgent(deps, { ...input, text });
    try {
      return {
        ...run,
        priced: priceIntents(run.output.lineItems, {
          services: input.pack.services,
          scopeClauses: input.pack.project?.scopeClauses ?? [],
        }),
      };
    } catch (error) {
      if (!(error instanceof PricingError)) throw error;
      if (attempt === 0) {
        text = `${input.text}\n\nThe previous attempt could not be priced: ${error.message}. Cite only clause and rule ids that appear in the context.`;
        continue;
      }
      const output: AgentOutput = {
        lineItems: [],
        needsInfo: [
          {
            question: `We could not match part of your request to the contracted scope (${error.message}). Could you describe what you need in other words?`,
            whyItChangesPrice: 'The price depends on which service or clause applies.',
          },
        ],
        explanation: 'Please clarify the requested scope before we prepare a price.',
        deliveryDays: 0,
        confidence: 0,
      };
      return {
        output,
        runId: run.runId,
        priced: { lineItems: [], subtotalCents: 0, totalCents: 0 },
      };
    }
  }
}
export async function submitRequest(deps: Deps, input: SubmitInput): Promise<Quote> {
  let previous: Quote | undefined;
  if ('quoteId' in input) {
    previous = await getQuote(deps.db, input.quoteId);
    const request = await getRequest(deps.db, previous.requestId);
    if (request.clientId !== input.clientId)
      throw new AppError('forbidden', 'Quote belongs to another client', { status: 403 });
    if (previous.status !== 'needs_info')
      throw new AppError(
        'quote_not_awaiting_answers',
        'Only a quote that needs information accepts answers',
        { status: 409 },
      );
  } else if (
    input.projectId &&
    (await getProject(deps.db, input.projectId)).clientId !== input.clientId
  )
    throw new AppError('forbidden', 'Project belongs to another client', { status: 403 });
  const service =
    'serviceId' in input && input.serviceId
      ? await getService(deps.db, input.serviceId)
      : undefined;
  if (service && service.businessId !== (await getClient(deps.db, input.clientId)).businessId)
    throw new AppError('forbidden', 'Service belongs to another business', { status: 403 });
  const fixedRules = service?.pricingRules.filter((rule) => rule.type === 'fixed') ?? [];
  const fixed = fixedRules.length === 1 ? fixedRules[0] : undefined;
  const request = previous
    ? await getRequest(deps.db, previous.requestId)
    : await createRequest(deps.db, input as Extract<SubmitInput, { text: string }>);
  try {
    let output: AgentOutput;
    let runId: string | undefined;
    let priced: PricedQuote;
    if (service && fixed) {
      output = {
        lineItems: [
          {
            kind: 'rule',
            ref: { id: fixed.id, version: fixed.version },
            quantity: 1,
            label: service.name,
            rationale: 'Fixed-price service bought from the storefront.',
          },
        ],
        deliveryDays: service.deliveryDays,
        explanation: `Fixed price for ${service.name}.`,
        needsInfo: [],
        confidence: 1,
      };
      priced = priceIntents(output.lineItems, { services: [service], scopeClauses: [] });
    } else {
      const pack = await deps.agent.buildContextPack(deps.db, {
        clientId: input.clientId,
        ...(request.projectId ? { projectId: request.projectId } : {}),
      });
      const run = await runPricedAgent(deps, {
        pack,
        text: request.text,
        skill: request.projectId ? 'analyze-additional' : 'contract-service',
        requestId: request.id,
        ...('answers' in input ? { answers: input.answers } : {}),
      });
      output = run.output;
      runId = run.runId;
      priced = run.priced;
    }
    const quote = await createQuoteVersion(deps.db, {
      requestId: request.id,
      ...(request.projectId ? { projectId: request.projectId } : {}),
      ...(previous ? { quoteId: previous.id } : {}),
      priced,
      agentOutput: output,
      ...(runId ? { agentRunId: runId } : {}),
      status: output.needsInfo.length ? 'needs_info' : 'published',
    });
    await setRequestStatus(deps.db, request.id, output.needsInfo.length ? 'needs_info' : 'quoted');
    deps.events.publish(
      makeEvent(deps, {
        type: output.needsInfo.length ? 'quote.needs_info' : 'quote.published',
        projectId: quote.projectId ?? null,
        quote,
      }),
    );
    return quote;
  } catch (error) {
    await setRequestStatus(deps.db, request.id, 'failed');
    if (error instanceof AgentRunError)
      throw new AppError(
        error.code === 'invalid_output' ? 'invalid_agent_output' : 'agent_failed',
        error.message,
        { status: error.status, cause: error },
      );
    throw new AppError('agent_failed', 'The agent could not prepare a quote', {
      status: 502,
      cause: error,
    });
  }
}
