import type { Mandate, Quote } from '@dealingwith/contracts';

import { DEMO } from '../db/demo-data.js';
export const now = new Date('2026-11-07T12:00:00Z');
export function mandate(): Mandate {
  return {
    id: DEMO.mandate.id,
    clientId: DEMO.client.id,
    businessId: DEMO.business.id,
    projectId: DEMO.project.id,
    perPurchaseLimitCents: 10000,
    totalLimitCents: 30000,
    spentCents: 0,
    currency: 'USD',
    expiresAt: DEMO.mandate.expiresAt.toISOString(),
    status: 'active',
    funding: {
      paypalAuthorizationId: 'AUTH-1',
      fundingAmountCents: 200000,
      fundingCapturedCents: 0,
    },
  };
}
export function quote(totalCents = 6000): Quote {
  return {
    id: 'a0000000-0000-4000-8000-000000000099',
    requestId: 'a0000000-0000-4000-8000-000000000098',
    projectId: DEMO.project.id,
    version: 1,
    status: 'published',
    lineItems: [],
    subtotalCents: totalCents,
    totalCents,
    currency: 'USD',
    explanation: '',
    deliveryDays: 0,
    needsInfo: [],
  };
}
