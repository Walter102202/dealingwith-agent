import type {
  ClientAgent,
  Mandate,
  Payment,
  Project,
  Quote,
  Request,
  Service,
  Session,
} from '@dealingwith/contracts';
import { DEMO_IDS } from './demo-ids.js';

/**
 * In-memory demo state for fixtures mode: the seed of `demo-data.ts` as the
 * web sees it through the API. `resetState()` restores it, keeping the
 * mandate's funding and the connected agents, exactly like `resetDemoData`.
 */

export const BUSINESS = { id: DEMO_IDS.business, name: 'Andes Data Studio' } as const;
export const CLIENT = { id: DEMO_IDS.client, name: 'Lukas Retail GmbH', contact: 'Mara Keller' };

export const SERVICES: Service[] = [
  {
    id: DEMO_IDS.S1,
    businessId: BUSINESS.id,
    name: 'Analytics dashboard build',
    description:
      'A KPI dashboard on one data source, with up to five views and two revision rounds.',
    pricingRules: [
      {
        id: 'S1.price',
        version: 1,
        type: 'fixed',
        label: 'Analytics dashboard build',
        amountCents: 120000,
      },
    ],
    inclusions: [
      'up to 5 views, including a per-branch view',
      'one data source',
      'two revision rounds',
    ],
    exclusions: ['automations, scheduled emails and alerts', 'additional data sources'],
    deliveryDays: 15,
  },
  {
    id: DEMO_IDS.S2,
    businessId: BUSINESS.id,
    name: 'Automations',
    description: 'Scheduled report emails and threshold alerts on an existing dashboard.',
    pricingRules: [
      {
        id: 'S2.report',
        version: 1,
        type: 'fixed',
        label: 'Scheduled report email',
        amountCents: 8000,
      },
      {
        id: 'S2.alert',
        version: 1,
        type: 'fixed',
        label: 'Threshold alert email',
        amountCents: 6000,
      },
    ],
    inclusions: ['one automation per rule, on an existing dashboard'],
    exclusions: ['new views', 'new data sources'],
    deliveryDays: 1,
  },
  {
    id: DEMO_IDS.S3,
    businessId: BUSINESS.id,
    name: 'Data source integration',
    description: 'Connect an additional data source to an existing dashboard.',
    pricingRules: [
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
    ],
    inclusions: ['connector', 'validation', 'one view update'],
    exclusions: ['dashboard redesign'],
    deliveryDays: 5,
  },
];

const initialProject = (): Project => ({
  id: DEMO_IDS.project,
  businessId: BUSINESS.id,
  clientId: CLIENT.id,
  serviceId: DEMO_IDS.S1,
  title: 'Retail KPI dashboard',
  status: 'in_progress',
  scopeClauses: [
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
  ],
  totalContractedCents: 120000,
});

const initialMandate = (): Mandate => ({
  id: DEMO_IDS.mandate,
  clientId: CLIENT.id,
  businessId: BUSINESS.id,
  projectId: DEMO_IDS.project,
  perPurchaseLimitCents: 10000,
  totalLimitCents: 30000,
  spentCents: 0,
  currency: 'USD',
  expiresAt: '2026-12-31T23:59:59.000Z',
  status: 'pending',
  funding: { fundingAmountCents: 200000, fundingCapturedCents: 0 },
});

export interface FixtureState {
  session: Session | null;
  project: Project;
  requests: Request[];
  quotes: Quote[];
  payments: Payment[];
  mandate: Mandate | null;
  agents: ClientAgent[];
  counters: { request: number; quote: number; payment: number; order: number; agent: number };
}

const freshState = (): FixtureState => ({
  session: null,
  project: initialProject(),
  requests: [],
  quotes: [],
  payments: [],
  mandate: initialMandate(),
  agents: [],
  counters: { request: 0, quote: 0, payment: 0, order: 0, agent: 0 },
});

export let state: FixtureState = freshState();

/** Back to the seed. Funding and agents survive, like the backend's reset. */
export function resetState(): void {
  const previous = state;
  state = freshState();
  state.session = previous.session;
  state.agents = previous.agents;
  if (previous.mandate && state.mandate) {
    state.mandate.funding = previous.mandate.funding;
    if (previous.mandate.status === 'active') state.mandate.status = 'active';
  }
}

/** Full reset, for tests: forgets the session, the agents and the funding too. */
export function hardResetState(): void {
  state = freshState();
}

export const nowIso = () => new Date().toISOString();
