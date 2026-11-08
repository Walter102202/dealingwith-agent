import type { Quote, QuoteLineItem } from '@dealingwith/contracts';
import { DEMO_IDS, fixtureId } from './demo-ids.js';

/**
 * Hand-written quotes for the five demo requests of spec section 6 plus the
 * storefront purchase. Keyed by the same substrings as the backend's demo
 * agent outputs. These are fixtures, not an engine: the amounts are the
 * spec's, typed once here.
 */

const included = (scopeRef: string, label: string, rationale: string): QuoteLineItem => ({
  kind: 'included',
  scopeRef,
  label,
  rationale,
  unitAmountCents: 0,
  amountCents: 0,
});

const rule = (
  id: string,
  label: string,
  rationale: string,
  unitAmountCents: number,
  quantity = 1,
): QuoteLineItem => ({
  kind: 'rule',
  ref: { id, version: 1 },
  ruleRef: { id, version: 1 },
  quantity,
  label,
  rationale,
  unitAmountCents,
  amountCents: unitAmountCents * quantity,
});

const PUBLISHED_AT = '2026-11-08T14:00:00.000Z';

const base = (
  n: number,
  projectId: string | null,
): Pick<Quote, 'id' | 'requestId' | 'version' | 'currency' | 'needsInfo'> &
  Partial<Pick<Quote, 'projectId'>> => ({
  id: fixtureId('b', n),
  requestId: fixtureId('c', n),
  version: 1,
  currency: 'USD',
  needsInfo: [],
  ...(projectId ? { projectId } : {}),
});

export const DEMO_QUOTES: Record<string, Quote> = {
  'summary email every Monday': {
    ...base(1, DEMO_IDS.project),
    status: 'published',
    lineItems: [
      included(
        'C1',
        'Per-branch view',
        'Covered by clause C1: five views including a per-branch view.',
      ),
      rule(
        'S2.report',
        'Weekly Monday summary email',
        'Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1.',
        8000,
      ),
    ],
    subtotalCents: 8000,
    totalCents: 8000,
    explanation:
      'The per-branch view is included. The weekly summary email is an additional automation.',
    deliveryDays: 1,
    publishedAt: PUBLISHED_AT,
  },
  'Amazon sales as a second source': {
    ...base(2, DEMO_IDS.project),
    status: 'published',
    lineItems: [
      rule(
        'S3.base',
        'Data source integration: Amazon',
        'Clause C3 includes Shopify only; rule S3.base.v1 prices a new integration.',
        15000,
      ),
      rule(
        'S3.per_source',
        'Additional data source: Amazon',
        'Amazon is one additional source under rule S3.per_source.v1.',
        4000,
      ),
    ],
    subtotalCents: 19000,
    totalCents: 19000,
    explanation:
      'Amazon adds one data source to the existing dashboard. Standard delivery applies.',
    deliveryDays: 5,
    publishedAt: PUBLISHED_AT,
  },
  'daily sales drop more than 20%': {
    ...base(3, DEMO_IDS.project),
    status: 'published',
    lineItems: [
      rule(
        'S2.alert',
        'Daily sales drop alert (20%)',
        'Alerts are excluded by clause C2 and priced with rule S2.alert.v1.',
        6000,
      ),
    ],
    subtotalCents: 6000,
    totalCents: 6000,
    explanation: 'This adds a threshold alert to your existing dashboard.',
    deliveryDays: 1,
    publishedAt: PUBLISHED_AT,
  },
  'regional managers too': {
    ...base(4, DEMO_IDS.project),
    status: 'published',
    lineItems: [
      included(
        'C4',
        'Monday summary to regional managers',
        'The purchased Monday summary is covered by clause C4.',
      ),
    ],
    subtotalCents: 0,
    totalCents: 0,
    explanation: 'The summary email is already included in the paid additional scope.',
    deliveryDays: 0,
    publishedAt: PUBLISHED_AT,
  },
  'load faster': {
    ...base(5, DEMO_IDS.project),
    status: 'needs_info',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 0,
    explanation: 'We need to identify the source of slowness before quoting a change.',
    deliveryDays: 0,
    needsInfo: [
      {
        question: 'Is the slowness caused by data volume or by the dashboard design?',
        whyItChangesPrice:
          'More data means a data source integration; a redesign means a new dashboard build.',
      },
    ],
  },
  'Buy Analytics dashboard build': {
    ...base(6, null),
    status: 'published',
    lineItems: [
      rule(
        'S1.price',
        'Analytics dashboard build',
        'A new dashboard on one data source, priced with rule S1.price.v1.',
        120000,
      ),
    ],
    subtotalCents: 120000,
    totalCents: 120000,
    explanation:
      'A KPI dashboard on one data source, with up to five views and two revision rounds.',
    deliveryDays: 15,
    publishedAt: PUBLISHED_AT,
  },
};

/** The first fixture whose key is a case-insensitive substring of `text`, or null. */
export function matchDemoQuote(text: string): Quote | null {
  const haystack = text.toLowerCase();
  for (const [key, quote] of Object.entries(DEMO_QUOTES)) {
    if (haystack.includes(key.toLowerCase())) return quote;
  }
  return null;
}
