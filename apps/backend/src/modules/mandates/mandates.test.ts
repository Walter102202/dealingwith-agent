import { randomUUID } from 'node:crypto';
import { MandateSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import {
  findMandateForProject,
  fundingHeadroomCents,
  getMandate,
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
