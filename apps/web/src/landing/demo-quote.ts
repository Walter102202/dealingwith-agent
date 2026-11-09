import type { Quote } from '@dealingwith/contracts';

/** The first request of the demo script, word for word. */
export const DEMO_REQUEST = 'I need a per-branch view and a summary email every Monday.';

/**
 * The quote that request produces on the hosted demo (`docs/demo-script.md`,
 * shot 3), typed once for the landing page. It is a picture of the product,
 * not a price: the hosted engine computes the real one. A test parses it with
 * `QuoteSchema` so it cannot drift from the contracts.
 */
export const DEMO_QUOTE: Quote = {
  id: '00000000-0000-4000-8000-0000000000a1',
  requestId: '00000000-0000-4000-8000-0000000000a2',
  projectId: '00000000-0000-4000-8000-0000000000a3',
  version: 1,
  status: 'paid',
  currency: 'USD',
  lineItems: [
    {
      kind: 'included',
      scopeRef: 'C1',
      label: 'Per-branch view',
      rationale: 'Covered by clause C1: five views including a per-branch view.',
      unitAmountCents: 0,
      amountCents: 0,
    },
    {
      kind: 'rule',
      ref: { id: 'S2.report', version: 1 },
      ruleRef: { id: 'S2.report', version: 1 },
      quantity: 1,
      label: 'Weekly Monday summary email',
      rationale: 'Scheduled emails are excluded by clause C2 and priced with rule S2.report.v1.',
      unitAmountCents: 8000,
      amountCents: 8000,
    },
  ],
  subtotalCents: 8000,
  totalCents: 8000,
  explanation:
    'The per-branch view is included. The weekly summary email is an additional automation.',
  deliveryDays: 1,
  needsInfo: [],
  publishedAt: '2026-11-08T14:00:00.000Z',
};

export const REPO_URL = 'https://github.com/Walter102202/dealingwith-agent';
export const MCP_GUIDE_URL = `${REPO_URL}/blob/main/docs/mcp.md`;
