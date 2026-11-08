import type { Quote } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import {
  formatAcceptResultMarkdown,
  formatMandateMarkdown,
  formatQuoteMarkdown,
} from './format.js';

const base: Quote = {
  id: 'a0000000-0000-4000-8000-000000000101',
  requestId: 'a0000000-0000-4000-8000-000000000102',
  projectId: 'a0000000-0000-4000-8000-000000000031',
  version: 1,
  status: 'published',
  lineItems: [
    {
      kind: 'rule',
      ref: { id: 'S2.alert', version: 1 },
      quantity: 1,
      label: 'Daily sales drop alert (20%)',
      rationale: 'Alerts are excluded by clause C2.',
      unitAmountCents: 6000,
      amountCents: 6000,
      ruleRef: { id: 'S2.alert', version: 1 },
    },
  ],
  subtotalCents: 6000,
  totalCents: 6000,
  currency: 'USD',
  explanation: 'This adds a threshold alert to your existing dashboard.',
  deliveryDays: 1,
  needsInfo: [],
};
describe('formatQuoteMarkdown', () => {
  test('renders heading, lines with money, total, delivery and explanation', () => {
    const text = formatQuoteMarkdown(base);
    expect(text).toContain(`# Quote ${base.id} v1 — published`);
    expect(text).toContain(
      '- Daily sales drop alert (20%): US$60.00 (Alerts are excluded by clause C2.)',
    );
    expect(text).toContain('Total: US$60.00');
    expect(text).toContain('Delivery: 1 days');
    expect(text).toContain(base.explanation);
    expect(text).not.toContain('Questions:');
  });
  test('lists the open questions of a needs_info quote', () => {
    const text = formatQuoteMarkdown({
      ...base,
      status: 'needs_info',
      needsInfo: [{ question: 'Which branches?', whyItChangesPrice: 'One alert per branch.' }],
    });
    expect(text).toContain('Questions:');
    expect(text).toContain('- Which branches? (One alert per branch.)');
  });
});
describe('formatAcceptResultMarkdown', () => {
  test('describes paid, approval required and denied results', () => {
    expect(
      formatAcceptResultMarkdown({
        status: 'paid',
        payment: {
          id: 'pay-1',
          quoteId: base.id,
          quoteVersion: 1,
          mode: 'mandate',
          amountCents: 6000,
          currency: 'USD',
          status: 'captured',
          createdAt: '2026-11-07T12:00:00.000Z',
        },
      }),
    ).toBe('Paid US$60.00 (payment pay-1).');
    expect(
      formatAcceptResultMarkdown({
        status: 'approval_required',
        message: 'Above the per-purchase limit.',
        approvalUrl: 'http://localhost:3000/mock-paypal/approve/o1',
      }),
    ).toBe(
      'Approval required: Above the per-purchase limit. Open http://localhost:3000/mock-paypal/approve/o1 to pay with PayPal.',
    );
    expect(formatAcceptResultMarkdown({ status: 'denied', message: 'Stale version.' })).toBe(
      'Denied: Stale version.',
    );
  });
});
describe('formatMandateMarkdown', () => {
  test('says when the agent has no mandate', () => {
    expect(formatMandateMarkdown(null)).toContain('no mandate');
  });
});
