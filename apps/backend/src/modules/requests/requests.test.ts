import { RequestSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, type Db } from '../../db/client.js';
import { DEMO } from '../../db/demo-data.js';
import { seedDemo } from '../../db/seed.js';
import { createTestDb } from '../../db/test-db.js';
import {
  createRequest,
  getRequest,
  listRequestsForBusiness,
  setRequestStatus,
} from './requests.js';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});
afterAll(async () => {
  await closeDb(db);
});
describe('createRequest', () => {
  test('trims text and returns the request contract with absent optional fields', async () => {
    const request = RequestSchema.parse(
      await createRequest(db, { clientId: DEMO.client.id, channel: 'web', text: '  Hello  ' }),
    );
    expect(request).toMatchObject({ text: 'Hello', status: 'open' });
    expect(request).not.toHaveProperty('projectId');
    expect(await getRequest(db, request.id)).toEqual(request);
    expect(await setRequestStatus(db, request.id, 'quoted')).toMatchObject({ status: 'quoted' });
    expect(await listRequestsForBusiness(db, DEMO.business.id)).toHaveLength(1);
  });
  test.each(['x'.repeat(2001), '   '])(
    'rejects text outside the trimmed length bounds',
    async (text) => {
      await expect(
        createRequest(db, { clientId: DEMO.client.id, channel: 'web', text }),
      ).rejects.toMatchObject({ code: 'invalid_request', status: 400 });
    },
  );
});
