import type { AgentOutput, LineItemIntent } from '@dealingwith/contracts';

const rule = (id: string, label: string, rationale: string): LineItemIntent => ({
  kind: 'rule',
  ref: { id, version: 1 },
  quantity: 1,
  label,
  rationale,
});
export const DEMO_AGENT_OUTPUTS: Record<string, AgentOutput> = {
  'summary email every Monday': {
    lineItems: [
      {
        kind: 'included',
        scopeRef: 'C1',
        label: 'Per-branch view',
        rationale: 'Covered by clause C1: five views including a per-branch view.',
      },
      rule(
        'S2.report',
        'Weekly Monday summary email',
        'Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1.',
      ),
    ],
    needsInfo: [],
    deliveryDays: 1,
    confidence: 0.9,
    explanation:
      'The per-branch view is included. The weekly summary email is an additional automation.',
  },
  'Amazon sales as a second source': {
    lineItems: [
      rule(
        'S3.base',
        'Data source integration: Amazon',
        'Clause C3 includes Shopify only; rule S3.base.v1 prices a new integration.',
      ),
      rule(
        'S3.per_source',
        'Additional data source: Amazon',
        'Amazon is one additional source under rule S3.per_source.v1.',
      ),
    ],
    needsInfo: [],
    deliveryDays: 5,
    confidence: 0.9,
    explanation:
      'Amazon adds one data source to the existing dashboard. Standard delivery applies.',
  },
  'daily sales drop more than 20%': {
    lineItems: [
      rule(
        'S2.alert',
        'Daily sales drop alert (20%)',
        'Alerts are excluded by clause C2 and priced with rule S2.alert.v1.',
      ),
    ],
    needsInfo: [],
    deliveryDays: 1,
    confidence: 0.9,
    explanation: 'This adds a threshold alert to your existing dashboard.',
  },
  'regional managers too': {
    lineItems: [
      {
        kind: 'included',
        scopeRef: 'C4',
        label: 'Monday summary to regional managers',
        rationale: 'The purchased Monday summary is covered by clause C4.',
      },
    ],
    needsInfo: [],
    deliveryDays: 0,
    confidence: 0.9,
    explanation: 'The summary email is already included in the paid additional scope.',
  },
  'load faster': {
    lineItems: [],
    needsInfo: [
      {
        question: 'Is the slowness caused by data volume or by the dashboard design?',
        whyItChangesPrice:
          'More data means a data source integration; a redesign means a new dashboard build.',
      },
    ],
    deliveryDays: 0,
    confidence: 0.4,
    explanation: 'We need to identify the source of slowness before quoting a change.',
  },
};
