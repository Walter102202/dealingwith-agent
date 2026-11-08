import type { AcceptQuoteReason } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { mandate, quote } from '../../test/policy.js';
import { policyMessage } from './messages.js';

describe('policyMessage', () => {
  test.each<[AcceptQuoteReason, string]>([
    [
      'mandate_inactive',
      'The mandate is active; the agent can only pay from an active mandate. Approve this payment in PayPal.',
    ],
    [
      'mandate_expired',
      'The mandate expired on 2026-12-31. Approve this payment in PayPal or set a new mandate.',
    ],
    [
      'wrong_project',
      'This quote belongs to another project; the mandate covers only its own project.',
    ],
    ['currency_mismatch', 'The quote is in USD; the mandate pays in USD.'],
    ['stale_version', 'Quote version 1 is no longer current; the latest published version is 2.'],
    [
      'over_per_purchase',
      'US$190.00 exceeds the per-purchase limit of US$100.00. Approve this payment in PayPal.',
    ],
    [
      'over_total',
      'US$190.00 would exceed the remaining mandate budget of US$50.00. Approve this payment in PayPal.',
    ],
    [
      'funding_exhausted',
      'US$190.00 exceeds the remaining PayPal authorization of US$2,000.00. Approve this payment in PayPal or re-authorize the mandate.',
    ],
    ['no_mandate', 'No mandate covers this project; approve this payment in PayPal.'],
    ['not_acceptable', 'Quote version 1 is published and cannot be accepted.'],
  ])('renders %s verbatim', (reason, message) => {
    expect(
      policyMessage(reason, {
        amountCents: 19000,
        mandate: { ...mandate(), spentCents: 25000 },
        quote: quote(),
        latestPublishedVersion: 2,
      }),
    ).toBe(message);
  });
  test('explains the absence of a published version', () => {
    expect(
      policyMessage('stale_version', {
        amountCents: 0,
        quote: quote(),
        latestPublishedVersion: null,
      }),
    ).toBe('Quote version 1 cannot be accepted; there is no published version.');
  });
});
