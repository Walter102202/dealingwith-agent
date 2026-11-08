import type { ClientAgent, Payment, Project, Quote } from '@dealingwith/contracts';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { getPayment } from '../modules/payments/payments.js';
import { getProject } from '../modules/projects/projects.js';
import { getQuote } from '../modules/quotes/quotes.js';
import { getRequest } from '../modules/requests/requests.js';

/** Scope checks for MCP tools: an agent acts only on its own client's records. */
const forbidden = (what: string) =>
  new AppError('forbidden', `${what} not accessible`, { status: 403 });

export async function assertAgentOwnsProject(
  db: Db,
  projectId: string,
  agent: ClientAgent,
): Promise<Project> {
  const project = await getProject(db, projectId);
  if (project.clientId !== agent.clientId) throw forbidden('project');
  return project;
}

async function quoteBelongsToAgent(db: Db, quote: Quote, agent: ClientAgent): Promise<boolean> {
  const request = await getRequest(db, quote.requestId);
  return request.clientId === agent.clientId;
}

/** Resolves the latest version of the quote and checks the agent's client owns it. */
export async function assertAgentOwnsQuote(
  db: Db,
  quoteId: string,
  agent: ClientAgent,
): Promise<Quote> {
  const quote = await getQuote(db, quoteId);
  if (!(await quoteBelongsToAgent(db, quote, agent))) throw forbidden('quote');
  return quote;
}

export async function assertAgentOwnsPayment(
  db: Db,
  paymentId: string,
  agent: ClientAgent,
): Promise<Payment> {
  const payment = await getPayment(db, paymentId);
  const quote = await getQuote(db, payment.quoteId, payment.quoteVersion);
  if (!(await quoteBelongsToAgent(db, quote, agent))) throw forbidden('payment');
  return payment;
}
