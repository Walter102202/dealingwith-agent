import type { Mandate } from '@dealingwith/contracts';
import { DEMO_IDS } from '../demo-ids.js';
import { BUSINESS, CLIENT, state } from '../state.js';
import { notFound, origin, pad } from './shared.js';

export const mandatesHandlers = {
  createMandate(body: {
    projectId: string;
    perPurchaseLimitCents: number;
    totalLimitCents: number;
    expiresAt: string;
  }): Mandate {
    state.mandate = {
      id: DEMO_IDS.mandate,
      clientId: CLIENT.id,
      businessId: BUSINESS.id,
      projectId: body.projectId,
      perPurchaseLimitCents: body.perPurchaseLimitCents,
      totalLimitCents: body.totalLimitCents,
      spentCents: 0,
      currency: 'USD',
      expiresAt: body.expiresAt,
      status: 'pending',
      funding: { fundingAmountCents: 0, fundingCapturedCents: 0 },
    };
    return state.mandate;
  },

  updateMandate(
    id: string,
    body: { perPurchaseLimitCents: number; totalLimitCents: number; expiresAt: string },
  ): Mandate {
    const mandate = mandatesHandlers.requireMandate(id);
    Object.assign(mandate, body);
    return mandate;
  },

  fundMandate(
    id: string,
    body: { fundingAmountCents: number },
  ): { approvalUrl: string; orderId: string } {
    const mandate = mandatesHandlers.requireMandate(id);
    const orderId = `MOCK-ORDER-${pad(++state.counters.order)}`;
    mandate.funding.fundingAmountCents = body.fundingAmountCents;
    return {
      approvalUrl: `${origin()}/portal/mandates/${id}/funded?token=${orderId}`,
      orderId,
    };
  },

  completeFunding(id: string, body: { orderId: string }): Mandate {
    const mandate = mandatesHandlers.requireMandate(id);
    mandate.status = 'active';
    mandate.funding = {
      paypalAuthorizationId: `MOCK-AUTH-${body.orderId.slice(-6)}`,
      fundingAmountCents: mandate.funding.fundingAmountCents,
      fundingCapturedCents: 0,
      fundingExpiresAt: '2026-12-31T23:59:59.000Z',
    };
    return mandate;
  },

  revokeMandate(id: string): Mandate {
    const mandate = mandatesHandlers.requireMandate(id);
    mandate.status = 'revoked';
    return mandate;
  },

  requireMandate(id: string): Mandate {
    if (!state.mandate || state.mandate.id !== id) throw notFound('Mandate');
    return state.mandate;
  },
};
