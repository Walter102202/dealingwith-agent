import { randomUUID } from 'node:crypto';
import { AGENT_TOKEN_PATTERN, ClientAgentSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../db/client.js';
import { DEMO } from '../db/demo-data.js';
import { clientAgents } from '../db/schema.js';
import { seedDemo } from '../db/seed.js';
import { createTestDb } from '../db/test-db.js';
import {
  authenticateAgentToken,
  issueAgentToken,
  listAgents,
  revokeAgentToken,
} from './agent-tokens.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
describe('agent tokens', () => {
  test('stores only the hash, records use, isolates revocation and keeps revoked agents listed', async () => {
    const { token, agent } = await issueAgentToken(db, {
      clientId: DEMO.client.id,
      label: 'Assistant',
    });
    expect(token).toMatch(AGENT_TOKEN_PATTERN);
    expect(ClientAgentSchema.parse(agent)).toEqual(agent);
    const [row] = await db.select().from(clientAgents);
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(await authenticateAgentToken(db, token)).toMatchObject({
      id: agent.id,
      lastUsedAt: expect.any(String),
    });
    expect(await authenticateAgentToken(db, `dwa_${'x'.repeat(43)}`)).toBeNull();
    await expect(
      revokeAgentToken(db, { agentId: agent.id, clientId: randomUUID() }),
    ).rejects.toMatchObject({ status: 404 });
    await revokeAgentToken(db, { agentId: agent.id, clientId: DEMO.client.id });
    expect(await authenticateAgentToken(db, token)).toBeNull();
    expect(await listAgents(db, DEMO.client.id)).toMatchObject([{ revokedAt: expect.any(String) }]);
  });
});
