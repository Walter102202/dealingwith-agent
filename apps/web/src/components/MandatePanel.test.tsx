import type { Mandate } from '@dealingwith/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

import { DEMO_IDS } from '../api/fixtures/demo-ids.js';
import { MandatePanel } from './MandatePanel.js';

const pending: Mandate = {
  id: DEMO_IDS.mandate,
  clientId: DEMO_IDS.client,
  businessId: DEMO_IDS.business,
  projectId: DEMO_IDS.project,
  perPurchaseLimitCents: 10000,
  totalLimitCents: 30000,
  spentCents: 0,
  currency: 'USD',
  expiresAt: '2026-12-31T23:59:59.000Z',
  status: 'pending',
  funding: { fundingAmountCents: 200000, fundingCapturedCents: 0 },
};

const funded: Mandate = {
  ...pending,
  status: 'active',
  funding: {
    paypalAuthorizationId: 'MOCK-AUTH-000001',
    fundingAmountCents: 200000,
    fundingCapturedCents: 0,
    fundingExpiresAt: '2026-12-31T23:59:59.000Z',
  },
};

const noop = async () => {};

describe('MandatePanel', () => {
  it('shows spend against the total limit and offers to authorize a pending mandate', () => {
    render(
      <MandatePanel mandate={pending} projectId={DEMO_IDS.project} payments={[]} onChange={noop} />,
    );
    expect(screen.getByText('Spent US$0.00 of US$300.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize with PayPal' })).toBeInTheDocument();
    expect(screen.queryByText('Backed by PayPal authorization')).toBeNull();
  });

  it('shows the PayPal backing and the headroom of a funded mandate', () => {
    render(
      <MandatePanel mandate={funded} projectId={DEMO_IDS.project} payments={[]} onChange={noop} />,
    );
    expect(screen.getByText('Backed by PayPal authorization')).toBeInTheDocument();
    expect(screen.getByText('US$2,000.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-authorize' })).toBeNull();
  });

  it('offers Re-authorize when the headroom is below the per-purchase limit', () => {
    const low: Mandate = {
      ...funded,
      funding: { ...funded.funding, fundingAmountCents: 200000, fundingCapturedCents: 191000 },
    };
    render(
      <MandatePanel mandate={low} projectId={DEMO_IDS.project} payments={[]} onChange={noop} />,
    );
    expect(screen.getByText('US$90.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-authorize' })).toBeInTheDocument();
  });

  it('shows the mandate form when the project has no mandate', () => {
    render(
      <MandatePanel mandate={null} projectId={DEMO_IDS.project} payments={[]} onChange={noop} />,
    );
    expect(screen.getByLabelText('Per purchase (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Total (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Expires on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set budget' })).toBeInTheDocument();
  });
});
