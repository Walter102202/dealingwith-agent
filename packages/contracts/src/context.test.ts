import { describe, expect, test } from 'vitest';
import { ContextPackSchema } from './context.js';

const P1_PACK = {
  business: { name: 'Andes Data Studio', currency: 'USD' },
  services: [
    {
      id: 'a0000000-0000-4000-8000-000000000012',
      businessId: 'a0000000-0000-4000-8000-000000000001',
      name: 'Automations',
      description: 'Scheduled emails and alerts.',
      pricingRules: [
        {
          id: 'S2.report',
          version: 1,
          type: 'fixed',
          label: 'Scheduled report email',
          amountCents: 8000,
        },
      ],
      inclusions: ['one automation per rule'],
      exclusions: ['new views'],
      deliveryDays: 1,
    },
  ],
  project: {
    id: 'a0000000-0000-4000-8000-000000000031',
    title: 'Retail KPI dashboard',
    scopeClauses: [
      { id: 'C1', text: 'Five views', included: true, source: { kind: 'contract' } },
      {
        id: 'C4',
        text: 'Weekly Monday summary email',
        included: true,
        source: { kind: 'quote', quoteId: 'a0000000-0000-4000-8000-000000000099', version: 1 },
      },
    ],
  },
  priorQuotes: [
    {
      quoteId: 'a0000000-0000-4000-8000-000000000099',
      version: 1,
      status: 'paid',
      lineItems: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Weekly Monday summary email',
          rationale: 'Excluded by C2, priced by S2.report.',
          unitAmountCents: 8000,
          amountCents: 8000,
          ruleRef: { id: 'S2.report', version: 1 },
        },
      ],
    },
  ],
  mandate: { perPurchaseLimitCents: 10000, remainingCents: 22000 },
  openQuestions: [
    { quoteId: 'a0000000-0000-4000-8000-000000000098', question: 'Data volume or design change?' },
  ],
};

describe('ContextPackSchema', () => {
  test('parses a P1-shaped pack with paid additionals, prior quotes and a mandate', () => {
    const pack = ContextPackSchema.parse(P1_PACK);
    expect(pack.project?.scopeClauses).toHaveLength(2);
    expect(pack.priorQuotes[0]?.status).toBe('paid');
    expect(pack.mandate?.remainingCents).toBe(22000);
  });

  test('allows a pack without project or mandate (new request outside a project)', () => {
    const pack = ContextPackSchema.parse({
      ...P1_PACK,
      project: null,
      priorQuotes: [],
      mandate: null,
      openQuestions: [],
    });
    expect(pack.project).toBeNull();
    expect(pack.mandate).toBeNull();
  });

  test('rejects a non-USD business', () => {
    expect(
      ContextPackSchema.safeParse({ ...P1_PACK, business: { name: 'X', currency: 'EUR' } }).success,
    ).toBe(false);
  });
});
