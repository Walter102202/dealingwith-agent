import type { DomainEvent, LineItemIntent, RequestChannel } from '@dealingwith/contracts';
import { closeDb } from '../db/client.js';
import { DEMO } from '../db/demo-data.js';
import { seedDemo } from '../db/seed.js';
import { createTestDb } from '../db/test-db.js';
import { loadEnv } from '../env.js';
import { MockPaypalGateway } from '../integrations/paypal/mock.js';
import { AppError } from '../lib/errors.js';
import { listServices } from '../modules/catalog/catalog.js';
import { getProject } from '../modules/projects/projects.js';
import { priceIntents } from '../modules/quotes/pricing.js';
import { createQuoteVersion } from '../modules/quotes/quotes.js';
import { createRequest } from '../modules/requests/requests.js';
import { createLogger } from '../observability/logger.js';
import type { Deps } from '../workflows/deps.js';
import { createEventBus } from '../workflows/events.js';
import { completeFunding, startFunding } from '../workflows/mandate-funding.js';
import { processWebhook } from '../workflows/webhooks.js';
export async function createHarness(overrides: Partial<Deps> = {}) {
  const db = await createTestDb();
  await seedDemo(db);
  const env = loadEnv({ DATABASE_URL: 'pglite://memory' });
  const events: DomainEvent[] = [];
  const bus = createEventBus();
  bus.subscribe((event) => {
    events.push(event);
  });
  const now = () => new Date('2026-11-07T12:00:00Z');
  const paypal = new MockPaypalGateway({
    appUrl: env.APP_URL,
    webhookSecret: env.MOCK_WEBHOOK_SECRET,
    now,
    deliverWebhook: async (event, headers) => {
      await processWebhook(deps, { headers, rawBody: JSON.stringify(event) });
    },
  });
  const fail = async (): Promise<never> => {
    throw new AppError('agent_not_configured', 'This harness does not run the agent', {
      status: 500,
    });
  };
  const deps: Deps = {
    db,
    paypal,
    events: bus,
    env,
    now,
    logger: createLogger({}, { silent: true }),
    agent: { buildContextPack: fail, runAgent: fail },
    assistant: null,
    ...overrides,
  };
  return { deps, paypal, events, close: () => closeDb(db) };
}
export async function publishedQuote(
  deps: Deps,
  input: { intents: LineItemIntent[]; projectId?: string; channel?: RequestChannel },
) {
  const projectId = input.projectId ?? DEMO.project.id;
  const project = await getProject(deps.db, projectId);
  const request = await createRequest(deps.db, {
    clientId: DEMO.client.id,
    projectId,
    channel: input.channel ?? 'web',
    text: 'Test request',
  });
  const agentOutput = {
    lineItems: input.intents,
    needsInfo: [],
    explanation: 'Test quote',
    deliveryDays: 1,
    confidence: 1,
  };
  return createQuoteVersion(deps.db, {
    requestId: request.id,
    projectId,
    agentOutput,
    status: 'published',
    priced: priceIntents(input.intents, {
      services: await listServices(deps.db, DEMO.business.id),
      scopeClauses: project.scopeClauses,
    }),
  });
}
export async function activateMandate(deps: Deps, fundingAmountCents = 200000) {
  const order = await startFunding(deps, { mandateId: DEMO.mandate.id, fundingAmountCents });
  if (!(deps.paypal instanceof MockPaypalGateway))
    throw new AppError('mock_required', 'Tests require the mock gateway');
  await deps.paypal.approve(order.orderId);
  return completeFunding(deps, { mandateId: DEMO.mandate.id, orderId: order.orderId });
}
