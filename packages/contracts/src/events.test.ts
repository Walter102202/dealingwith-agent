import { describe, expect, test } from 'vitest';
import { DomainEventSchema } from './events.js';

const QUOTE = {
  id: 'a0000000-0000-4000-8000-000000000061',
  requestId: 'a0000000-0000-4000-8000-000000000071',
  projectId: 'a0000000-0000-4000-8000-000000000031',
  version: 1,
  status: 'published',
  lineItems: [],
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
  explanation: '',
  deliveryDays: 0,
  needsInfo: [],
};

const PAYMENT = {
  id: 'a0000000-0000-4000-8000-000000000081',
  quoteId: QUOTE.id,
  quoteVersion: 1,
  mode: 'pay_now',
  amountCents: 8000,
  currency: 'USD',
  status: 'created',
  createdAt: '2026-11-07T20:00:00.000Z',
};

describe('DomainEventSchema', () => {
  test('parses a quote.published event with a null projectId', () => {
    const event = DomainEventSchema.parse({
      id: 'evt-1',
      at: '2026-11-07T20:00:00.000Z',
      projectId: null,
      type: 'quote.published',
      quote: QUOTE,
    });
    expect(event.type).toBe('quote.published');
  });

  test('payment.approval_required requires an approval URL', () => {
    const result = DomainEventSchema.safeParse({
      id: 'evt-2',
      at: '2026-11-07T20:00:00.000Z',
      projectId: QUOTE.projectId,
      type: 'payment.approval_required',
      payment: PAYMENT,
    });
    expect(result.success).toBe(false);
  });

  test('rejects an unknown event type', () => {
    const result = DomainEventSchema.safeParse({
      id: 'evt-3',
      at: '2026-11-07T20:00:00.000Z',
      projectId: null,
      type: 'quote.deleted',
    });
    expect(result.success).toBe(false);
  });
});
