import type { AgentOutput } from '@dealingwith/contracts';

/**
 * The mock provider's truth: one fixed output per demo request (spec section 6,
 * plan Task A7 table). `match` is a case-insensitive regular expression tested
 * against the request text, or against the answers when a question is answered.
 * The same five objects live as JSON in `evals/scenarios/fixtures/`; a test
 * keeps both copies identical.
 */
export type MockFixture = { match: string; output: AgentOutput };

export const MOCK_FIXTURES: readonly MockFixture[] = [
  {
    match: 'summary email every Monday',
    output: {
      lineItems: [
        {
          kind: 'included',
          scopeRef: 'C1',
          label: 'Per-branch view',
          rationale: 'Covered by clause C1: five views including a per-branch view.',
        },
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          quantity: 1,
          label: 'Weekly Monday summary email',
          rationale:
            'Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1.',
        },
      ],
      needsInfo: [],
      explanation:
        'The per-branch view is already part of your dashboard. The Monday summary email is a scheduled report automation, which is an extra on this project.',
      deliveryDays: 1,
      confidence: 0.9,
    },
  },
  {
    match: 'Amazon sales as a second source',
    output: {
      lineItems: [
        {
          kind: 'rule',
          ref: { id: 'S3.base', version: 1 },
          quantity: 1,
          label: 'Data source integration: Amazon',
          rationale:
            'Clause C3 limits the contract to one data source (Shopify); a second source is priced with rule S3.base.v1.',
        },
        {
          kind: 'rule',
          ref: { id: 'S3.per_source', version: 1 },
          quantity: 1,
          label: 'Additional data source: Amazon',
          rationale: 'One additional source, priced with rule S3.per_source.v1.',
        },
      ],
      needsInfo: [],
      explanation:
        'Connecting Amazon as a second data source is an integration on top of your Shopify-only contract. No rush was requested, so standard delivery applies.',
      deliveryDays: 5,
      confidence: 0.9,
    },
  },
  {
    match: 'daily sales drop more than 20%',
    output: {
      lineItems: [
        {
          kind: 'rule',
          ref: { id: 'S2.alert', version: 1 },
          quantity: 1,
          label: 'Daily sales drop alert (20%)',
          rationale: 'Alerts are excluded by clause C2 and priced with rule S2.alert.v1.',
        },
      ],
      needsInfo: [],
      explanation:
        'A threshold alert email on an existing dashboard is an automation, which your contract excludes, so it is quoted as an extra.',
      deliveryDays: 1,
      confidence: 0.9,
    },
  },
  {
    match: 'regional managers too',
    output: {
      lineItems: [
        {
          kind: 'included',
          scopeRef: 'C4',
          label: 'Monday summary to regional managers',
          rationale: 'Covered by clause C4: the weekly Monday summary email you already purchased.',
        },
      ],
      needsInfo: [],
      explanation:
        'Adding recipients to the Monday summary email is part of the automation you already paid for, so there is nothing to pay.',
      deliveryDays: 0,
      confidence: 0.9,
    },
  },
  {
    match: 'load faster',
    output: {
      lineItems: [],
      needsInfo: [
        {
          question: 'Is the slowness caused by data volume or by the dashboard design?',
          whyItChangesPrice:
            'More data means a data source integration; a redesign means a new dashboard build.',
        },
      ],
      explanation:
        'Before quoting I need to know what is making the dashboard slow, because the two likely causes map to different services.',
      deliveryDays: 0,
      confidence: 0.4,
    },
  },
];

/** The first fixture whose `match` matches the text, ignoring case; `null` when none does. */
export function findFixture(text: string): MockFixture | null {
  return MOCK_FIXTURES.find((f) => new RegExp(f.match, 'i').test(text)) ?? null;
}
