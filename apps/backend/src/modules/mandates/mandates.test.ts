import { randomUUID } from 'node:crypto';
import { MandateSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import {
  findLatestMandateForClient,
  findMandateForProject,
  fundingHeadroomCents,
  getMandate,
  mandateForAgent,
  remainingCents,
} from './mandates.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
describe('getMandate', () => {
  test('maps the seeded, unfunded mandate to the contract', async () => {
    const m = MandateSchema.parse(await getMandate(db, DEMO.mandate.id));
    expect(remainingCents(m)).toBe(30000);
    expect(fundingHeadroomCents(m)).toBe(0);
    expect(m.funding.paypalAuthorizationId).toBeUndefined();
  });
});
describe('findMandateForProject', () => {
  test('finds M1 and returns null for an unrelated project', async () => {
    expect(
      await findMandateForProject(db, { projectId: DEMO.project.id, clientId: DEMO.client.id }),
    ).toMatchObject({ id: DEMO.mandate.id });
    expect(
      await findMandateForProject(db, { projectId: randomUUID(), clientId: DEMO.client.id }),
    ).toBeNull();
  });
});
describe('mandateForAgent', () => {
  const agent = { clientId: DEMO.client.id };
  test('an agent without its own mandate pays from the project budget, shared by the client agents', async () => {
    expect(await mandateForAgent(db, agent, DEMO.project.id)).toMatchObject({
      id: DEMO.mandate.id,
    });
    expect(await mandateForAgent(db, agent, randomUUID())).toBeNull();
    expect(await mandateForAgent(db, agent, undefined)).toBeNull();
  });
  test('an attached mandate wins over the project', async () => {
    expect(
      await mandateForAgent(db, { ...agent, mandateId: DEMO.mandate.id }, undefined),
    ).toMatchObject({ id: DEMO.mandate.id });
  });
  test('findLatestMandateForClient returns the client mandate that is not revoked', async () => {
    expect(await findLatestMandateForClient(db, DEMO.client.id)).toMatchObject({
      id: DEMO.mandate.id,
    });
    expect(await findLatestMandateForClient(db, randomUUID())).toBeNull();
  });
});
