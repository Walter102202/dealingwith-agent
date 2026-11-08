import { describe, expect, test } from 'vitest';
import { PaymentSchema } from './payment.js';

const base = {
  id: 'a0000000-0000-4000-8000-000000000091',
  quoteId: 'a0000000-0000-4000-8000-000000000081',
  quoteVersion: 1,
  mode: 'mandate',
  amountCents: 6000,
  currency: 'USD',
  status: 'captured',
  createdAt: '2026-11-07T12:00:00.000Z',
} as const;

describe('PaymentSchema', () => {
  test('keeps the mandate a mandate payment was charged against', () => {
    const parsed = PaymentSchema.parse({
      ...base,
      mandateId: 'a0000000-0000-4000-8000-000000000041',
    });
    expect(parsed.mandateId).toBe('a0000000-0000-4000-8000-000000000041');
  });

  test('a pay-now payment has no mandate', () => {
    const parsed = PaymentSchema.parse({ ...base, mode: 'pay_now' });
    expect(parsed.mandateId).toBeUndefined();
  });
});
