import { StreamableHTTPTransport } from '@hono/mcp';
import { type Context, Hono } from 'hono';
import { authenticateAgentToken } from '../access/agent-tokens.js';
import type { ApiEnv } from '../api/auth.js';
import { createMcpServer } from './server.js';

const BEARER = /^Bearer\s+(\S+)$/i;
const unauthenticated = (c: Context<ApiEnv>) =>
  c.json({ error: { code: 'unauthenticated', message: 'invalid token' } }, 401);

async function handle(c: Context<ApiEnv>, token: string | undefined): Promise<Response> {
  const deps = c.get('deps');
  const agent = token ? await authenticateAgentToken(deps.db, token) : null;
  if (!agent) return unauthenticated(c);
  const server = createMcpServer(deps, agent);
  // No sessionIdGenerator: stateless mode (exactOptionalPropertyTypes forbids an explicit undefined).
  const transport = new StreamableHTTPTransport({});
  await server.connect(transport);
  return (await transport.handleRequest(c)) ?? c.body(null, 204);
}

/** `/mcp` with `Authorization: Bearer dwa_…`, or the capability URL `/mcp/:token`. */
export function mcpRoutes(): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.all('/mcp', (c) => handle(c, BEARER.exec(c.req.header('authorization') ?? '')?.[1]));
  app.all('/mcp/:token', (c) => handle(c, c.req.param('token')));
  return app;
}
