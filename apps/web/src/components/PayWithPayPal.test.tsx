import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render.js';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get, post: apiMock.post } };
});

const navigationMock = vi.hoisted(() => ({ assign: vi.fn() }));
vi.mock('../lib/navigation.js', () => ({ assign: navigationMock.assign }));

import { PayWithPayPal } from './PayWithPayPal.js';

const quoteId = 'b0000000-0000-4000-8000-000000000001';
const config = (paypalMode: 'mock' | 'sandbox') => ({
  paypalMode,
  ...(paypalMode === 'sandbox' ? { paypalClientId: 'test-client-id' } : {}),
  appUrl: 'http://localhost:5173',
  demoMode: paypalMode === 'mock',
  assistant: { enabled: false },
});

describe('PayWithPayPal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['mock', 'sandbox'] as const)(
    'in %s mode shows one "Pay with PayPal" button and sends the browser to the approval URL',
    async (mode) => {
      apiMock.get.mockResolvedValue(config(mode));
      apiMock.post.mockResolvedValue({
        status: 'approval_required',
        approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1',
      });
      renderWithProviders(
        <PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }));
      await waitFor(() => {
        expect(navigationMock.assign).toHaveBeenCalledWith(
          'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1',
        );
      });
      expect(apiMock.post).toHaveBeenCalledWith(
        `/api/quotes/${quoteId}/accept`,
        { version: 1 },
        expect.anything(),
      );
      expect(screen.queryByTestId('paypal-buttons')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Approve in mock PayPal' })).toBeNull();
    },
  );

  it('a zero total answered "paid" without a payment counts as paid (real backend shape)', async () => {
    apiMock.get.mockResolvedValue(config('mock'));
    apiMock.post.mockResolvedValue({
      status: 'paid',
      message: 'Nothing to pay: everything requested is already included in the project scope.',
    });
    const onPaid = vi.fn();
    renderWithProviders(
      <PayWithPayPal quoteId={quoteId} version={1} amountCents={0} onPaid={onPaid} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at no cost' }));
    await waitFor(() => {
      expect(onPaid).toHaveBeenCalledTimes(1);
    });
    expect(navigationMock.assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the denial message when accept is denied', async () => {
    apiMock.get.mockResolvedValue(config('mock'));
    apiMock.post.mockResolvedValue({
      status: 'denied',
      reason: 'stale_version',
      message: 'Quote v1 was replaced by v2.',
    });
    renderWithProviders(
      <PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote v1 was replaced by v2.');
    expect(navigationMock.assign).not.toHaveBeenCalled();
  });

  it('shows an error when the backend answers approval_required without a link', async () => {
    apiMock.get.mockResolvedValue(config('sandbox'));
    apiMock.post.mockResolvedValue({ status: 'approval_required' });
    renderWithProviders(
      <PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'PayPal did not return an approval link.',
    );
  });
});
