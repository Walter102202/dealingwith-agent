import { IdSchema, IssuedAgentSchema } from '@dealingwith/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import { issueAgentToken, listAgents, revokeAgentToken } from '../../access/agent-tokens.js';
import { connectionSnippets } from '../../access/snippets.js';
import { type ApiEnv, clientId, requireSession } from '../auth.js';
import { jsonBody } from '../validate.js';
export function agentRoutes() {
  const app = new Hono<ApiEnv>();
  app.get('/api/agents', requireSession('client'), async (c) =>
    c.json(await listAgents(c.get('deps').db, clientId(c))),
  );
  app.post(
    '/api/agents',
    requireSession('client'),
    jsonBody(
      z.object({ label: z.string().trim().min(1).max(200), mandateId: IdSchema.optional() }),
    ),
    async (c) => {
      const deps = c.get('deps');
      const data = c.req.valid('json');
      const issued = await issueAgentToken(deps.db, {
        clientId: clientId(c),
        label: data.label,
        ...(data.mandateId ? { mandateId: data.mandateId } : {}),
      });
      return c.json(
        IssuedAgentSchema.parse({
          ...issued,
          snippets: connectionSnippets({ appUrl: deps.env.APP_URL, token: issued.token }),
        }),
        201,
      );
    },
  );
  app.delete('/api/agents/:id', requireSession('client'), async (c) =>
    c.json(
      await revokeAgentToken(c.get('deps').db, {
        agentId: IdSchema.parse(c.req.param('id')),
        clientId: clientId(c),
      }),
    ),
  );
  return app;
}
