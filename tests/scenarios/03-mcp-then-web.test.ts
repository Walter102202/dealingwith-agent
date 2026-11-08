import { IssuedAgentSchema, QuoteSchema } from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { submitRequest } from '../../apps/backend/src/workflows/submit-request.js';
import { createScenario, post } from './helpers.js';

test('Starts via MCP, continues on web: both channels see the same quote id, version and price', async () => {
  const s = await createScenario();
  try {
    const issued = IssuedAgentSchema.parse(
      await (await s.request('/api/agents', post({ label: "Mara's assistant" }))).json(),
    );
    const quote = await submitRequest(s.deps, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'mcp',
      agentId: issued.agent.id,
      text: "Alert me by email when any branch's daily sales drop more than 20%.",
    });
    const web = QuoteSchema.parse(await (await s.request(`/api/quotes/${quote.id}`)).json());
    expect(web).toEqual(quote);
    expect(web.totalCents).toBe(6000);
  } finally {
    await s.close();
  }
});
