import { type ClientAgent, connectionSnippets, type IssuedAgent } from '@dealingwith/contracts';
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
    return { token, agent, snippets: connectionSnippets({ appUrl: origin(), token }) };
  },

  revokeAgent(id: string): ClientAgent {
    const agent = state.agents.find((a) => a.id === id);
    if (!agent) throw notFound('Agent');
    agent.revokedAt = nowIso();
    return agent;
  },
};
