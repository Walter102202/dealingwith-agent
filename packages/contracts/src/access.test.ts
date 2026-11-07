import { describe, expect, test } from 'vitest';
import {
  AGENT_SCOPES,
  AgentTokenSchema,
  ClientAgentSchema,
  IssuedAgentSchema,
  SessionSchema,
} from './access.js';

const CLIENT_ID = 'a0000000-0000-4000-8000-000000000021';
const BUSINESS_ID = 'a0000000-0000-4000-8000-000000000001';
const AGENT_ID = 'a0000000-0000-4000-8000-000000000051';
const TOKEN = `dwa_${'A'.repeat(43)}`;

describe('SessionSchema', () => {
  test('accepts a client and a provider session', () => {
    const client = SessionSchema.parse({
      role: 'client',
      clientId: CLIENT_ID,
      businessId: BUSINESS_ID,
      name: 'Mara',
    });
    const provider = SessionSchema.parse({
      role: 'provider',
      businessId: BUSINESS_ID,
      name: 'Andes Data Studio',
    });
    expect(client.role).toBe('client');
    expect(provider.role).toBe('provider');
  });

  test('rejects a client session without clientId', () => {
    const result = SessionSchema.safeParse({ role: 'client', businessId: BUSINESS_ID, name: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('agent tokens', () => {
  test('match the dwa_ prefix plus 43 base64url characters', () => {
    expect(AgentTokenSchema.safeParse(TOKEN).success).toBe(true);
    expect(AgentTokenSchema.safeParse('dwa_short').success).toBe(false);
    expect(AgentTokenSchema.safeParse(`sk_${'A'.repeat(43)}`).success).toBe(false);
  });

  test('an issued agent carries the token once, the agent and three snippets', () => {
    const issued = IssuedAgentSchema.parse({
      token: TOKEN,
      agent: {
        id: AGENT_ID,
        clientId: CLIENT_ID,
        label: "Mara's assistant",
        scopes: [...AGENT_SCOPES],
        createdAt: '2026-11-07T20:00:00.000Z',
      },
      snippets: { claudeDesktop: 'url', claudeCode: 'cmd', cursor: '{}' },
    });
    expect(issued.agent.scopes).toEqual(['quote:request', 'quote:accept']);
  });

  test('a client agent never carries a token hash', () => {
    const parsed = ClientAgentSchema.parse({
      id: AGENT_ID,
      clientId: CLIENT_ID,
      label: 'x',
      scopes: [],
      createdAt: '2026-11-07T20:00:00.000Z',
      tokenHash: 'leaked',
    });
    expect('tokenHash' in parsed).toBe(false);
  });
});
