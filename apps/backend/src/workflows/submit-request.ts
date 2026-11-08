import type { Quote, RequestChannel } from '@dealingwith/contracts';
import { AgentRunError } from '../agent/run.js';
import { AppError } from '../lib/errors.js';
import { getProject } from '../modules/projects/projects.js';
import { PricingError } from '../modules/quotes/errors.js';
import { priceIntents } from '../modules/quotes/pricing.js';
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
    }
  | {
      quoteId: string;
      answers: Record<string, string>;
      clientId: string;
      channel: RequestChannel;
      agentId?: string;
    };
export async function submitRequest(deps: Deps, input: SubmitInput): Promise<Quote> {
  let previous: Quote | undefined;
  if ('quoteId' in input) {
    previous = await getQuote(deps.db, input.quoteId);
    const request = await getRequest(deps.db, previous.requestId);
    if (request.clientId !== input.clientId)
      throw new AppError('forbidden', 'Quote belongs to another client', { status: 403 });
  } else if (
    input.projectId &&
    (await getProject(deps.db, input.projectId)).clientId !== input.clientId
  )
    throw new AppError('forbidden', 'Project belongs to another client', { status: 403 });
  const request = previous
    ? await getRequest(deps.db, previous.requestId)
    : await createRequest(deps.db, input as Extract<SubmitInput, { text: string }>);
  try {
    const pack = await deps.agent.buildContextPack(deps.db, {
      clientId: input.clientId,
      ...(request.projectId ? { projectId: request.projectId } : {}),
    });
    const { output, runId } = await deps.agent.runAgent(deps, {
      pack,
      text: request.text,
      skill: request.projectId ? 'analyze-additional' : 'contract-service',
      requestId: request.id,
      ...('answers' in input ? { answers: input.answers } : {}),
    });
    const priced = priceIntents(output.lineItems, {
      services: pack.services,
      scopeClauses: pack.project?.scopeClauses ?? [],
    });
    const quote = await createQuoteVersion(deps.db, {
      requestId: request.id,
      ...(request.projectId ? { projectId: request.projectId } : {}),
      ...(previous ? { quoteId: previous.id } : {}),
      priced,
      agentOutput: output,
      agentRunId: runId,
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
    if (error instanceof PricingError) throw error;
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
