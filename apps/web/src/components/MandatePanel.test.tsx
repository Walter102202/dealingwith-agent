import type { Mandate } from '@dealingwith/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

const navigationMock = vi.hoisted(() => ({ assign: vi.fn() }));
vi.mock('../lib/navigation.js', () => ({ assign: navigationMock.assign }));

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
  funding: { fundingAmountCents: 0, fundingCapturedCents: 0 },
};

const funded: Mandate = {
  ...pending,
  status: 'active',
  funding: {
    paypalAuthorizationId: 'MOCK-AUTH-000001',
    fundingAmountCents: 30000,
    fundingCapturedCents: 0,
    fundingExpiresAt: '2026-12-31T23:59:59.000Z',
  },
};

const APPROVAL = 'http://localhost:5173/mock-paypal/approve/MOCK-ORDER-000001';
const noop = async () => {};
const panel = (mandate: Mandate | null, onChange: () => Promise<void> = noop) =>
  render(
    <MandatePanel
      mandate={mandate}
      projectId={DEMO_IDS.project}
      payments={[]}
      onChange={onChange}
    />,
  );
const openForm = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Assign a budget to your agent' }));

describe('MandatePanel', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.each(['revoked', 'expired', 'exhausted'] as const)(
    'does not offer funding for a %s mandate',
    (status) => {
      panel({ ...pending, status });
      expect(screen.queryByRole('button', { name: 'Assign a budget to your agent' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Re-authorize' })).toBeNull();
      expect(screen.getByText(`This mandate is ${status}.`)).toBeInTheDocument();
    },
  );

  it('shows the proposed limits of an unfunded mandate and offers to assign the budget', () => {
    panel(pending);
    expect(screen.getByText('No budget assigned yet')).toBeInTheDocument();
    expect(screen.getByText('US$100.00')).toBeInTheDocument();
    expect(screen.getByText('US$300.00')).toBeInTheDocument();
    expect(
      screen.getByText('Until you assign it, your agent asks you to approve every payment.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Assign a budget to your agent' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Backed by PayPal authorization')).toBeNull();
  });

  it('opens the form prefilled from the mandate and authorizes the total without saving unchanged limits', async () => {
    apiMock.post.mockResolvedValue({ approvalUrl: APPROVAL, orderId: 'MOCK-ORDER-000001' });
    panel(pending);
    openForm();
    expect(screen.getByLabelText('Per purchase (USD)')).toHaveValue(100);
    expect(screen.getByLabelText('Total (USD)')).toHaveValue(300);
    expect(screen.getByLabelText('Expires on')).toHaveValue('2026-12-31');
    expect(
      screen.getByText(
        'PayPal holds the total, US$300.00, and charges you only for what your agent spends.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    await waitFor(() => expect(navigationMock.assign).toHaveBeenCalledWith(APPROVAL));
    expect(apiMock.patch).not.toHaveBeenCalled();
    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}/fund`,
      { fundingAmountCents: 30000 },
      expect.anything(),
    );
  });

  it('saves edited limits first, then authorizes the new total', async () => {
    apiMock.patch.mockResolvedValue({ ...pending, totalLimitCents: 25000 });
    apiMock.post.mockResolvedValue({ approvalUrl: APPROVAL, orderId: 'MOCK-ORDER-000001' });
    panel(pending);
    openForm();
    fireEvent.change(screen.getByLabelText('Total (USD)'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Expires on'), { target: { value: '2027-01-31' } });
    expect(screen.getByText(/PayPal holds the total, US\$250\.00,/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    await waitFor(() => expect(navigationMock.assign).toHaveBeenCalledWith(APPROVAL));
    expect(apiMock.patch).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}`,
      {
        perPurchaseLimitCents: 10000,
        totalLimitCents: 25000,
        expiresAt: '2027-01-31T23:59:59.000Z',
      },
      expect.anything(),
    );
    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}/fund`,
      { fundingAmountCents: 25000 },
      expect.anything(),
    );
    expect(apiMock.patch.mock.invocationCallOrder[0]).toBeLessThan(
      apiMock.post.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('keeps an unchanged expiry exactly as stored when other limits change', async () => {
    apiMock.patch.mockResolvedValue(pending);
    apiMock.post.mockResolvedValue({ approvalUrl: APPROVAL, orderId: 'MOCK-ORDER-000001' });
    panel({ ...pending, expiresAt: '2026-12-31T12:00:00.000Z' });
    openForm();
    fireEvent.change(screen.getByLabelText('Per purchase (USD)'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    await waitFor(() => expect(navigationMock.assign).toHaveBeenCalledWith(APPROVAL));
    expect(apiMock.patch).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}`,
      {
        perPurchaseLimitCents: 8000,
        totalLimitCents: 30000,
        expiresAt: '2026-12-31T12:00:00.000Z',
      },
      expect.anything(),
    );
  });

  it('does not start PayPal when saving the limits fails', async () => {
    const onChange = vi.fn(async () => {});
    apiMock.patch.mockRejectedValue(new Error('Expiry must be in the future.'));
    panel(pending, onChange);
    openForm();
    fireEvent.change(screen.getByLabelText('Total (USD)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Expiry must be in the future.');
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(navigationMock.assign).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes the panel when the limits were saved but PayPal could not start', async () => {
    const onChange = vi.fn(async () => {});
    apiMock.patch.mockResolvedValue({ ...pending, totalLimitCents: 25000 });
    apiMock.post.mockRejectedValue(new Error('PayPal is not answering. Try again.'));
    panel(pending, onChange);
    openForm();
    fireEvent.change(screen.getByLabelText('Total (USD)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'PayPal is not answering. Try again.',
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(navigationMock.assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue to PayPal' })).toBeEnabled();
  });

  it('accepts amounts in cents', async () => {
    apiMock.patch.mockResolvedValue(pending);
    apiMock.post.mockResolvedValue({ approvalUrl: APPROVAL, orderId: 'MOCK-ORDER-000001' });
    panel(pending);
    openForm();
    expect(screen.getByLabelText('Total (USD)')).toHaveAttribute('step', '0.01');
    fireEvent.change(screen.getByLabelText('Total (USD)'), { target: { value: '250.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    await waitFor(() => expect(navigationMock.assign).toHaveBeenCalledWith(APPROVAL));
    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}/fund`,
      { fundingAmountCents: 25050 },
      expect.anything(),
    );
  });

  it('refuses a per-purchase limit above the total without calling the API', () => {
    panel(pending);
    openForm();
    fireEvent.change(screen.getByLabelText('Per purchase (USD)'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The per-purchase limit cannot be more than the total.',
    );
    expect(apiMock.patch).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('cancel closes the form and shows the proposed limits again', () => {
    panel(pending);
    openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Total (USD)')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Assign a budget to your agent' }),
    ).toBeInTheDocument();
  });

  it('shows the PayPal backing and the headroom of a funded mandate', () => {
    panel(funded);
    expect(screen.getByText('Spent US$0.00 of US$300.00')).toBeInTheDocument();
    expect(screen.getByText('Backed by PayPal authorization')).toBeInTheDocument();
    expect(screen.getByText('US$300.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-authorize' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Assign a budget to your agent' })).toBeNull();
  });

  it('offers Re-authorize when the headroom is below the per-purchase limit and holds what is left', async () => {
    apiMock.post.mockResolvedValue({ approvalUrl: APPROVAL, orderId: 'MOCK-ORDER-000002' });
    const low: Mandate = {
      ...funded,
      spentCents: 21000,
      funding: { ...funded.funding, fundingCapturedCents: 21000 },
    };
    panel(low);
    expect(screen.getByText('US$90.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-authorize' }));
    expect(
      screen.getByText(
        'PayPal holds what is left of the total, US$90.00, and charges you only for what your agent spends.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to PayPal' }));
    await waitFor(() => expect(navigationMock.assign).toHaveBeenCalledWith(APPROVAL));
    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/mandates/${DEMO_IDS.mandate}/fund`,
      { fundingAmountCents: 9000 },
      expect.anything(),
    );
  });

  it('shows the mandate form when the project has no mandate', () => {
    panel(null);
    expect(screen.getByLabelText('Per purchase (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Total (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Expires on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set budget' })).toBeInTheDocument();
  });
});
