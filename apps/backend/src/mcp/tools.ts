import { type ClientAgent, MCP_TOOLS, type McpToolName } from '@dealingwith/contracts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listServices } from '../modules/catalog/catalog.js';
import { getClient } from '../modules/clients/clients.js';
import { findLatestMandateForClient, mandateForAgent } from '../modules/mandates/mandates.js';
import { listProjectsForClient } from '../modules/projects/projects.js';
import { getQuote } from '../modules/quotes/quotes.js';
import { acceptQuote } from '../workflows/accept-quote.js';
import type { Deps } from '../workflows/deps.js';
import { submitRequest } from '../workflows/submit-request.js';
import {
  formatAcceptResultMarkdown,
  formatMandateMarkdown,
  formatPaymentMarkdown,
  formatProjectMarkdown,
  formatProjectsMarkdown,
  formatQuoteMarkdown,
  formatServicesMarkdown,
} from './format.js';
import { assertAgentOwnsPayment, assertAgentOwnsProject, assertAgentOwnsQuote } from './scope.js';

type ToolMeta = { title: string; description: string; readOnly: boolean };
const TOOL_META: Record<McpToolName, ToolMeta> = {
  list_services: {
    title: 'List services',
    description:
      "List the services and pricing rules your provider publishes. Prices are the provider's; the agent never computes them.",
    readOnly: true,
  },
  list_projects: {
    title: 'List projects',
    description:
      'List your projects with their ids, status and contracted amount. Call it first to find the projectId that get_project and request_quote take.',
    readOnly: true,
  },
  get_project: {
    title: 'Get project',
    description:
      'Read one of your projects: title, status, contracted amount and the scope clauses that say what is included and excluded.',
    readOnly: true,
  },
  request_quote: {
    title: 'Request a quote',
    description:
      'Describe work in plain language (at most 2000 characters). With projectId the request is an addition to that project; without it, a new engagement. Returns a priced quote, or a needs_info quote with questions to answer with answer_questions.',
    readOnly: false,
  },
  answer_questions: {
    title: 'Answer quote questions',
    description:
      'Answer the open questions of a needs_info quote. Returns a new version of the same quote (the previous version is superseded).',
    readOnly: false,
  },
  get_quote: {
    title: 'Get quote',
    description: 'Read the latest version of a quote: line items, total, delivery and explanation.',
    readOnly: true,
  },
  accept_quote: {
    title: 'Accept quote',
    description:
      'Accept a quote version. If the client has an active mandate and the amount is within its limits, the payment is captured immediately with PayPal and the response has status "paid". Otherwise the response has status "approval_required" with an approval_url that a human must open to pay with PayPal. Never promises payment outside the mandate.',
    readOnly: false,
  },
  get_payment: {
    title: 'Get payment',
    description: 'Read a payment of one of your quotes: amount, mode, status and PayPal ids.',
    readOnly: true,
  },
  get_mandate: {
    title: 'Get mandate',
    description:
      'Read the spending mandate this agent pays from: limits, spent amount, expiry and whether a PayPal authorization backs it. The agents of one client share the project budget, so an agent without a mandate of its own pays from the mandate of the project: pass projectId to read it (without it, the most recent mandate of the client). Null when there is none: every accepted quote then needs human approval.',
    readOnly: true,
  },
};

/** Title, description and annotations of a tool; the schemas are passed beside it so the SDK infers the argument types. */
function meta(name: McpToolName) {
  const { title, description, readOnly } = TOOL_META[name];
  return {
    title,
    description,
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: false,
      idempotentHint: readOnly,
      openWorldHint: false,
    },
  };
}

const text = (markdown: string, structuredContent: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: markdown }],
  structuredContent,
});

/** Registers the eight tools of spec section 7.6 plus list_projects, in `MCP_TOOL_NAMES` order, scoped to the authenticated agent. */
export function registerTools(server: McpServer, deps: Deps, agent: ClientAgent): void {
  const { db } = deps;
  server.registerTool(
    'list_services',
    {
      ...meta('list_services'),
      inputSchema: MCP_TOOLS.list_services.input,
      outputSchema: MCP_TOOLS.list_services.output,
    },
    async () => {
      const client = await getClient(db, agent.clientId);
      const services = await listServices(db, client.businessId);
      return text(formatServicesMarkdown(services), { services });
    },
  );
  server.registerTool(
    'list_projects',
    {
      ...meta('list_projects'),
      inputSchema: MCP_TOOLS.list_projects.input,
      outputSchema: MCP_TOOLS.list_projects.output,
    },
    async () => {
      const projects = await listProjectsForClient(db, agent.clientId);
      return text(formatProjectsMarkdown(projects), { projects });
    },
  );
  server.registerTool(
    'get_project',
    {
      ...meta('get_project'),
      inputSchema: MCP_TOOLS.get_project.input,
      outputSchema: MCP_TOOLS.get_project.output,
    },
    async ({ projectId }) => {
      const project = await assertAgentOwnsProject(db, projectId, agent);
      return text(formatProjectMarkdown(project), { project });
    },
  );
  server.registerTool(
    'request_quote',
    {
      ...meta('request_quote'),
      inputSchema: MCP_TOOLS.request_quote.input,
      outputSchema: MCP_TOOLS.request_quote.output,
    },
    async ({ projectId, text: body, serviceId }) => {
      const quote = await submitRequest(deps, {
        clientId: agent.clientId,
        ...(projectId ? { projectId } : {}),
        channel: 'mcp',
        agentId: agent.id,
        text: body,
        ...(serviceId ? { serviceId } : {}),
      });
      return text(formatQuoteMarkdown(quote), { quote });
    },
  );
  server.registerTool(
    'answer_questions',
    {
      ...meta('answer_questions'),
      inputSchema: MCP_TOOLS.answer_questions.input,
      outputSchema: MCP_TOOLS.answer_questions.output,
    },
    async ({ quoteId, answers }) => {
      const quote = await submitRequest(deps, {
        quoteId,
        answers,
        clientId: agent.clientId,
        channel: 'mcp',
        agentId: agent.id,
      });
      return text(formatQuoteMarkdown(quote), { quote });
    },
  );
  server.registerTool(
    'get_quote',
    {
      ...meta('get_quote'),
      inputSchema: MCP_TOOLS.get_quote.input,
      outputSchema: MCP_TOOLS.get_quote.output,
    },
    async ({ quoteId }) => {
      await assertAgentOwnsQuote(db, quoteId, agent);
      const quote = await getQuote(db, quoteId);
      return text(formatQuoteMarkdown(quote), { quote });
    },
  );
  server.registerTool(
    'accept_quote',
    {
      ...meta('accept_quote'),
      inputSchema: MCP_TOOLS.accept_quote.input,
      outputSchema: MCP_TOOLS.accept_quote.output,
    },
    async ({ quoteId, version }) => {
      const result = await acceptQuote(deps, {
        quoteId,
        version,
        actor: { kind: 'agent', agent },
      });
      return text(formatAcceptResultMarkdown(result), result);
    },
  );
  server.registerTool(
    'get_payment',
    {
      ...meta('get_payment'),
      inputSchema: MCP_TOOLS.get_payment.input,
      outputSchema: MCP_TOOLS.get_payment.output,
    },
    async ({ paymentId }) => {
      const payment = await assertAgentOwnsPayment(db, paymentId, agent);
      return text(formatPaymentMarkdown(payment), { payment });
    },
  );
  server.registerTool(
    'get_mandate',
    {
      ...meta('get_mandate'),
      inputSchema: MCP_TOOLS.get_mandate.input,
      outputSchema: MCP_TOOLS.get_mandate.output,
    },
    async ({ projectId }) => {
      if (projectId) await assertAgentOwnsProject(db, projectId, agent);
      const mandate =
        (await mandateForAgent(db, agent, projectId)) ??
        (projectId ? null : await findLatestMandateForClient(db, agent.clientId));
      return text(formatMandateMarkdown(mandate), { mandate });
    },
  );
}
