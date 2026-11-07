import type { PricingRule, ScopeClause } from '@dealingwith/contracts';

/**
 * The demo scenario of spec section 6, with fixed ids so that seeding is
 * idempotent and tests, docs and the video can reference the same records.
 */

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const S1_RULES: PricingRule[] = [
  {
    id: 'S1.price',
    version: 1,
    type: 'fixed',
    label: 'Analytics dashboard build',
    amountCents: 120000,
  },
];

const S2_RULES: PricingRule[] = [
  {
    id: 'S2.report',
    version: 1,
    type: 'fixed',
    label: 'Scheduled report email',
    amountCents: 8000,
  },
  { id: 'S2.alert', version: 1, type: 'fixed', label: 'Threshold alert email', amountCents: 6000 },
];

const S3_RULES: PricingRule[] = [
  {
    id: 'S3.base',
    version: 1,
    type: 'fixed',
    label: 'Data source integration base',
    amountCents: 15000,
  },
  {
    id: 'S3.per_source',
    version: 1,
    type: 'per_unit',
    label: 'Per data source',
    amountCents: 4000,
    unit: 'source',
  },
  {
    id: 'S3.rush',
    version: 1,
    type: 'multiplier',
    label: 'Rush under 48 h',
    percent: 25,
    conditions: 'delivery under 48 h',
  },
];

const P1_CLAUSES: ScopeClause[] = [
  {
    id: 'C1',
    text: 'Five views including a per-branch view',
    included: true,
    source: { kind: 'contract' },
  },
  {
    id: 'C2',
    text: 'Automations, scheduled emails and alerts',
    included: false,
    source: { kind: 'contract' },
  },
  { id: 'C3', text: 'One data source: Shopify', included: true, source: { kind: 'contract' } },
];

export const DEMO = {
  business: {
    id: id(1),
    name: 'Andes Data Studio',
    country: 'CL',
    currency: 'USD',
  },
  owner: {
    email: 'owner@andesdata.example',
  },
  services: {
    S1: {
      id: id(11),
      name: 'Analytics dashboard build',
      description:
        'A KPI dashboard on one data source, with up to five views and two revision rounds.',
      pricingRules: S1_RULES,
      inclusions: [
        'up to 5 views, including a per-branch view',
        'one data source',
        'two revision rounds',
      ],
      exclusions: ['automations, scheduled emails and alerts', 'additional data sources'],
      deliveryDays: 15,
    },
    S2: {
      id: id(12),
      name: 'Automations',
      description: 'Scheduled report emails and threshold alerts on an existing dashboard.',
      pricingRules: S2_RULES,
      inclusions: ['one automation per rule, on an existing dashboard'],
      exclusions: ['new views', 'new data sources'],
      deliveryDays: 1,
    },
    S3: {
      id: id(13),
      name: 'Data source integration',
      description: 'Connect an additional data source to an existing dashboard.',
      pricingRules: S3_RULES,
      inclusions: ['connector', 'validation', 'one view update'],
      exclusions: ['dashboard redesign'],
      deliveryDays: 5,
    },
  },
  client: {
    id: id(21),
    name: 'Lukas Retail GmbH',
    contact: 'Mara Keller',
    email: 'mara@lukasretail.example',
  },
  project: {
    id: id(31),
    title: 'Retail KPI dashboard',
    serviceId: id(11),
    status: 'in_progress',
    scopeClauses: P1_CLAUSES,
    totalContractedCents: 120000,
    contractedAt: new Date('2026-10-20T00:00:00Z'),
  },
  mandate: {
    id: id(41),
    perPurchaseLimitCents: 10000,
    totalLimitCents: 30000,
    currency: 'USD',
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    status: 'pending',
    fundingAmountCents: 200000,
    fundingCapturedCents: 0,
  },
  clientAgent: {
    label: "Mara's assistant",
  },
} as const;
