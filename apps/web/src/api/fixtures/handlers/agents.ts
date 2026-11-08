import type { ClientAgent, IssuedAgent } from '@dealingwith/contracts';
import { fixtureId } from '../demo-ids.js';
import { CLIENT, nowIso, state } from '../state.js';
import { activeAgents, notFound, origin, randomToken } from './shared.js';

export const agentsHandlers = {
  listAgents(): ClientAgent[] {
    return activeAgents();
  },

  async issueAgent(body: { label: string; mandateId?: string }): Promise<IssuedAgent> {
    const token = randomToken();
    const agent: ClientAgent = {
      id: fixtureId('e', ++state.counters.agent),
      clientId: CLIENT.id,
      label: body.label,
      scopes: ['quote:request', 'quote:accept'],
      ...(body.mandateId ? { mandateId: body.mandateId } : {}),
      createdAt: nowIso(),
    };
    state.agents.push(agent);
    const appUrl = origin();
    return {
      token,
      agent,
      snippets: {
        claudeDesktop: `${appUrl}/mcp/${token}\nAdd this URL as a custom connector in Claude Desktop (Settings → Connectors → Add custom connector). Treat it as a secret: anyone with the link can act as your agent.`,
        claudeCode: `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`,
        cursor: JSON.stringify(
          {
            mcpServers: {
              dealingwith: { url: `${appUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } },
            },
          },
          null,
          2,
        ),
      },
    };
  },

  revokeAgent(id: string): ClientAgent {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw notFound('Agent');
    agent.revokedAt = nowIso();
    return agent;
  },
};
