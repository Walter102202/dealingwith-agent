import { randomUUID } from 'node:crypto';
import { ServiceSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import { getService, listServices } from './catalog.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
describe('listServices', () => {
  test('returns the three services ordered by name as valid contracts', async () => {
    const result = ServiceSchema.array().parse(await listServices(db, DEMO.business.id));
    expect(result.map((s) => s.id)).toEqual([
      DEMO.services.S1.id,
      DEMO.services.S2.id,
      DEMO.services.S3.id,
    ]);
  });
});
describe('getService', () => {
  test('returns a service or a stable missing error', async () => {
    expect((await getService(db, DEMO.services.S2.id)).name).toBe('Automations');
    await expect(getService(db, randomUUID())).rejects.toMatchObject({
      code: 'service_not_found',
      status: 404,
    });
  });
});
