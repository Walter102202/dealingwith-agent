import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import * as schema from './schema.js';
import { createTestDb } from './test-db.js';

function uniqueViolationCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  return cause?.code;
}

describe('createTestDb', () => {
  test('migrates the schema and round-trips a business row', async () => {
    const db = await createTestDb();
    const [inserted] = await db
      .insert(schema.businesses)
      .values({ name: 'Andes Data Studio', country: 'CL', currency: 'USD' })
      .returning();
    expect(inserted?.id).toMatch(/^[0-9a-f-]{36}$/);

    const [found] = await db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, inserted?.id ?? ''));
    expect(found?.name).toBe('Andes Data Studio');
  });

  test('rejects a second webhook event with the same paypal_event_id', async () => {
    const db = await createTestDb();
    const event = {
      paypalEventId: 'WH-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      resourceId: 'CAP-1',
      payload: { id: 'WH-1' },
    };
    await db.insert(schema.webhookEvents).values(event);
    const error = await db
      .insert(schema.webhookEvents)
      .values(event)
      .then(() => undefined)
      .catch((e: unknown) => e);
    // PostgreSQL SQLSTATE 23505 = unique_violation, surfaced as the cause of Drizzle's query error.
    expect(uniqueViolationCode(error)).toBe('23505');
  });
});
