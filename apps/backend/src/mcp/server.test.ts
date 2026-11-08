import { randomUUID } from 'node:crypto';
import { MCP_TOOL_NAMES } from '@dealingwith/contracts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { issueAgentToken, revokeAgentToken } from '../access/agent-tokens.js';
import { createApp } from '../api/app.js';
import { DEMO } from '../db/demo-data.js';
import {
  businesses,
  clients,
  payments,
  projects,
  quotes,
  requests,
  services,
} from '../db/schema.js';
import { activateMandate, createHarness } from '../test/workflow-harness.js';
import { fakeAgentPort } from '../workflows/fake-agent.js';

let h: Awaited<ReturnType<typeof createHarness>>;
let app: ReturnType<typeof createApp>;
let token: string;
let agentId: string;
const ALERT_TEXT = "Alert me by email when any branch's daily sales drop more than 20%.";
const AMAZON_TEXT = 'Add our Amazon sales as a second source.';
const UNKNOWN_TOKEN = `dwa_${'a'.repeat(43)}`;
/** The SDK client raises StreamableHTTPError with the HTTP status in code and the body in message. */
const UNAUTHORIZED = { code: 401, message: expect.stringContaining('invalid token') };

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};
type QuoteView = { id: string; version: number; totalCents: number; status: string };
async function connect(url: string, bearer?: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch: async (input, init) => app.request(input, init),
    ...(bearer ? { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
  });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(transport);
  return client;
}
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;
const structured = <T>(result: ToolResult) => result.structuredContent as T;
const countQuotes = async () =>
  (await h.deps.db.select().from(quotes).where(eq(quotes.projectId, DEMO.project.id))).length;

beforeAll(async () => {
  h = await createHarness({ agent: fakeAgentPort() });
  app = createApp(h.deps);
  const issued = await issueAgentToken(h.deps.db, {
    clientId: DEMO.client.id,
    label: 'Test agent',
    mandateId: DEMO.mandate.id,
  });
  token = issued.token;
  agentId = issued.agent.id;
});
afterAll(async () => {
  await h.close();
});

describe('MCP server', () => {
  test('forwards a fixed-price service selection to the shared workflow', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    try {
      const result = await call(client, 'request_quote', {
        text: 'Buy Analytics dashboard build',
        serviceId: DEMO.services.S1.id,
      });
      expect(result.isError).toBeFalsy();
      expect(structured<{ quote: QuoteView }>(result).quote).toMatchObject({
        status: 'published',
        totalCents: 120000,
      });
    } finally {
      await client.close();
    }
  });
  test('(a) lists exactly the tools of the contracts', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...MCP_TOOL_NAMES].sort());
    await client.close();
  });
  test('(b, c, g) request_quote prices with the engine, accept_quote pays within the mandate, quote:// renders it', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    const requested = await call(client, 'request_quote', {
      projectId: DEMO.project.id,
      text: ALERT_TEXT,
    });
    expect(requested.isError).toBeFalsy();
    const quote = structured<{ quote: QuoteView }>(requested).quote;
    expect(quote.totalCents).toBe(6000);
    expect(quote.status).toBe('published');
    expect(requested.content[0]?.text).toContain('US$60.00');
    await activateMandate(h.deps);
    const accepted = await call(client, 'accept_quote', {
      quoteId: quote.id,
      version: quote.version,
    });
    expect(accepted.isError).toBeFalsy();
    const result = structured<{ status: string; payment?: { id: string; status: string } }>(
      accepted,
    );
    expect(result.status).toBe('paid');
    expect(result.payment?.status).toBe('captured');
    expect(accepted.content[0]?.text).toMatch(/^Paid US\$60\.00 \(payment /);
    const resource = await client.readResource({ uri: `quote://${quote.id}` });
    const content = resource.contents[0];
    expect(content && 'text' in content ? content.text : '').toContain('US$60.00');
    const payment = await call(client, 'get_payment', { paymentId: result.payment?.id });
    expect(structured<{ payment: { status: string } }>(payment).payment.status).toBe('captured');
    const fetched = await call(client, 'get_quote', { quoteId: quote.id });
    expect(structured<{ quote: QuoteView }>(fetched).quote.status).toBe('paid');
    await client.close();
  });
  test('(d) a quote above the per-purchase limit returns approval_required with an approval URL', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    const requested = await call(client, 'request_quote', {
      projectId: DEMO.project.id,
      text: AMAZON_TEXT,
    });
    const quote = structured<{ quote: QuoteView }>(requested).quote;
    expect(quote.totalCents).toBe(19000);
    const accepted = await call(client, 'accept_quote', {
      quoteId: quote.id,
      version: quote.version,
    });
    const result = structured<{ status: string; approvalUrl?: string }>(accepted);
    expect(result.status).toBe('approval_required');
    expect(typeof result.approvalUrl).toBe('string');
    expect(accepted.content[0]?.text).toMatch(
      /^Approval required: .* Open http.* to pay with PayPal\.$/,
    );
    await client.close();
  });
  test('(e) an empty request is rejected before the handler and persists nothing', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    const before = await countQuotes();
    const rejected = await call(client, 'request_quote', { projectId: DEMO.project.id, text: '' });
    expect(rejected.isError).toBe(true);
    expect(rejected.content[0]?.text).toMatch(/text is required/);
    expect(await countQuotes()).toBe(before);
    await client.close();
  });
  test('(f) a project of another client is not accessible', async () => {
    const businessId = randomUUID();
    const clientId = randomUUID();
    const serviceId = randomUUID();
    const projectId = randomUUID();
    await h.deps.db
      .insert(businesses)
      .values({ id: businessId, name: 'Rival business', country: 'US' });
    await h.deps.db
      .insert(clients)
      .values({ id: clientId, businessId, name: 'Rival client', email: 'rival@example.test' });
    await h.deps.db.insert(services).values({ id: serviceId, businessId, name: 'Rival service' });
    await h.deps.db
      .insert(projects)
      .values({ id: projectId, businessId, clientId, serviceId, title: 'Rival project' });
    const client = await connect('http://mcp.test/mcp', token);
    const result = await call(client, 'get_project', { projectId });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('project not accessible');
    const own = await call(client, 'get_project', { projectId: DEMO.project.id });
    expect(structured<{ project: { id: string } }>(own).project.id).toBe(DEMO.project.id);
    const listed = await call(client, 'list_projects');
    const ids = structured<{ projects: { id: string }[] }>(listed).projects.map((p) => p.id);
    expect(ids).toContain(DEMO.project.id);
    expect(ids).not.toContain(projectId);
    expect(listed.content[0]?.text).toContain(`Retail KPI dashboard (${DEMO.project.id})`);
    expect(listed.content[0]?.text).not.toContain('Rival project');
    await client.close();
  });
  test('(l) quotes, payments and answers of another client are not accessible by any tool or the resource', async () => {
    const businessId = randomUUID();
    const clientId = randomUUID();
    const requestId = randomUUID();
    const quoteId = randomUUID();
    const paymentId = randomUUID();
    await h.deps.db
      .insert(businesses)
      .values({ id: businessId, name: 'Other business', country: 'US' });
    await h.deps.db
      .insert(clients)
      .values({ id: clientId, businessId, name: 'Other client', email: 'other@example.test' });
    await h.deps.db
      .insert(requests)
      .values({ id: requestId, clientId, channel: 'web', text: 'Other storefront request' });
    await h.deps.db.insert(quotes).values({
      quoteId,
      version: 1,
      requestId,
      status: 'published',
      explanation: 'Other tenant',
    });
    await h.deps.db.insert(payments).values({
      id: paymentId,
      quoteId,
      quoteVersion: 1,
      mode: 'pay_now',
      amountCents: 100,
      idempotencyKey: `test:${paymentId}`,
    });
    const client = await connect('http://mcp.test/mcp', token);
    const quote = await call(client, 'get_quote', { quoteId });
    expect(quote.isError).toBe(true);
    expect(quote.content[0]?.text).toBe('quote not accessible');
    const payment = await call(client, 'get_payment', { paymentId });
    expect(payment.isError).toBe(true);
    expect(payment.content[0]?.text).toBe('payment not accessible');
    const accepted = await call(client, 'accept_quote', { quoteId, version: 1 });
    expect(accepted.isError).toBe(true);
    expect(accepted.content[0]?.text).toBe('You cannot accept this quote');
    const answered = await call(client, 'answer_questions', { quoteId, answers: { q: 'a' } });
    expect(answered.isError).toBe(true);
    expect(answered.content[0]?.text).toBe('Quote belongs to another client');
    await expect(client.readResource({ uri: `quote://${quoteId}` })).rejects.toThrow(
      /quote not accessible/,
    );
    const rows = await h.deps.db.select().from(quotes).where(eq(quotes.quoteId, quoteId));
    expect(rows).toHaveLength(1);
    await client.close();
  });
  test('(m) the quote resource rejects a malformed id without leaking the query', async () => {
    const client = await connect('http://mcp.test/mcp', token);
    const failure = await client.readResource({ uri: 'quote://not-a-uuid' }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );
    expect(failure).toMatch(/quote id must be a UUID/);
    expect(failure).not.toMatch(/select|Failed query/i);
    await client.close();
  });
  test('(h) an unknown token gets 401 before any MCP parsing', async () => {
    await expect(connect('http://mcp.test/mcp', UNKNOWN_TOKEN)).rejects.toMatchObject(UNAUTHORIZED);
    const raw = await app.request('http://mcp.test/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${UNKNOWN_TOKEN}` },
    });
    expect(raw.status).toBe(401);
    expect(await raw.json()).toEqual({
      error: { code: 'unauthenticated', message: 'invalid token' },
    });
  });
  test('(j, k) the capability URL lists the same tools; get_mandate and list_services answer for the agent', async () => {
    const client = await connect(`http://mcp.test/mcp/${token}`);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...MCP_TOOL_NAMES].sort());
    const mandate = await call(client, 'get_mandate');
    expect(structured<{ mandate: { id: string } }>(mandate).mandate.id).toBe(DEMO.mandate.id);
    const list = await call(client, 'list_services');
    expect(structured<{ services: unknown[] }>(list).services).toHaveLength(3);
    await client.close();
  });
  test('(i) a revoked token gets 401 on both forms', async () => {
    await revokeAgentToken(h.deps.db, { agentId, clientId: DEMO.client.id });
    await expect(connect('http://mcp.test/mcp', token)).rejects.toMatchObject(UNAUTHORIZED);
    await expect(connect(`http://mcp.test/mcp/${token}`)).rejects.toMatchObject(UNAUTHORIZED);
  });
});
