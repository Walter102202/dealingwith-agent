import { describe, expect, test } from 'vitest';
import { mandate, now, quote } from '../../test/policy.js';
import { evaluate } from './evaluate.js';

describe('evaluate', () => {
  test('allows 6000 cents', () => {
    expect(
      evaluate({ mandate: mandate(), quote: quote(), latestPublishedVersion: 1, now }),
    ).toEqual({ outcome: 'allow' });
  });
  test('requires approval above the per-purchase limit', () => {
    expect(
      evaluate({ mandate: mandate(), quote: quote(19000), latestPublishedVersion: 1, now }),
    ).toEqual({
      outcome: 'needs_approval',
      reason: 'over_per_purchase',
      message:
        'US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal.',
    });
  });
  test.each([
    ['over_total', { spentCents: 25000 }],
    [
      'funding_exhausted',
      { funding: { fundingAmountCents: 200000, fundingCapturedCents: 195000 } },
    ],
    ['mandate_inactive', { status: 'pending' as const }],
    ['over_total', { status: 'exhausted' as const, spentCents: 30000 }],
    ['mandate_expired', { expiresAt: '2026-11-06T00:00:00Z' }],
  ])('reports %s', (reason, patch) => {
    expect(
      evaluate({
        mandate: { ...mandate(), ...patch },
        quote: quote(),
        latestPublishedVersion: 1,
        now,
      }),
    ).toMatchObject({ reason });
  });
  test.each([2, null])('denies stale versions when latest is %s', (latestPublishedVersion) => {
    expect(
      evaluate({ mandate: mandate(), quote: quote(), latestPublishedVersion, now }),
    ).toMatchObject({ outcome: 'deny', reason: 'stale_version' });
  });
  test('denies another project and currency before checking budget', () => {
    expect(
      evaluate({
        mandate: mandate(),
        quote: { ...quote(), projectId: DEMO_OTHER },
        latestPublishedVersion: 1,
        now,
      }),
    ).toMatchObject({ outcome: 'deny', reason: 'wrong_project' });
    expect(
      evaluate({
        mandate: mandate(),
        quote: { ...quote(), currency: 'EUR' as 'USD' },
        latestPublishedVersion: 1,
        now,
      }),
    ).toMatchObject({ outcome: 'deny', reason: 'currency_mismatch' });
  });
});
const DEMO_OTHER = 'a0000000-0000-4000-8000-000000000090';
