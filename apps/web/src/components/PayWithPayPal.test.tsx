import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get, post: apiMock.post } };
});

const navigationMock = vi.hoisted(() => ({ assign: vi.fn() }));
const sandboxMock = vi.hoisted(() => ({
  props: null as null | { createOrder: () => Promise<string>; onError: (error: unknown) => void },
}));
vi.mock('./PayPalSandboxButtons.js', () => ({
  default: (props: NonNullable<typeof sandboxMock.props>) => {
    sandboxMock.props = props;
    return <span>Sandbox buttons ready</span>;
  },
}));
vi.mock('../lib/navigation.js', () => ({ assign: navigationMock.assign }));

import { PayWithPayPal } from './PayWithPayPal.js';

const quoteId = 'b0000000-0000-4000-8000-000000000001';

describe('PayWithPayPal', () => {
  it('reports an already-paid sandbox order and rejects creation without an error message', async () => {
    apiMock.get.mockResolvedValue({
      paypalMode: 'sandbox',
      paypalClientId: 'test',
      appUrl: 'http://localhost:5173',
      demoMode: false,
    });
    const payment = { id: 'payment', status: 'captured', paypalOrderId: 'CAPTURED-ORDER' };
    apiMock.post.mockResolvedValue({ status: 'paid', payment });
    const onPaid = vi.fn();
    render(<PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={onPaid} />);
    await screen.findByText('Sandbox buttons ready');
    const buttons = sandboxMock.props;
    if (!buttons) throw new Error('Sandbox buttons not mounted');
    await act(async () => {
      const creation = buttons.createOrder();
      await expect(creation).rejects.toBeInstanceOf(Error);
      await creation.catch(buttons.onError);
    });
    expect(onPaid).toHaveBeenCalledExactlyOnceWith(payment);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('in mock mode shows "Approve in mock PayPal" and sends the browser to the approval URL', async () => {
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://localhost:5173',
      demoMode: true,
    });
    apiMock.post.mockResolvedValue({
      status: 'approval_required',
      approvalUrl: 'http://localhost:5173/pay/return?token=MOCK-ORDER-000001',
    });
    render(<PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />);
    const button = await screen.findByRole('button', { name: 'Approve in mock PayPal' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(navigationMock.assign).toHaveBeenCalledWith(
        'http://localhost:5173/pay/return?token=MOCK-ORDER-000001',
      );
    });
    expect(apiMock.post).toHaveBeenCalledWith(
      `/api/quotes/${quoteId}/accept`,
      { version: 1 },
      expect.anything(),
    );
  });

  it('a zero total answered "paid" without a payment counts as paid (real backend shape)', async () => {
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://localhost:5173',
      demoMode: true,
    });
    apiMock.post.mockResolvedValue({
      status: 'paid',
      message: 'Nothing to pay: everything requested is already included in the project scope.',
    });
    const onPaid = vi.fn();
    render(<PayWithPayPal quoteId={quoteId} version={1} amountCents={0} onPaid={onPaid} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at no cost' }));
    await waitFor(() => {
      expect(onPaid).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('in sandbox mode renders the PayPal container and no mock button', async () => {
    apiMock.get.mockResolvedValue({
      paypalMode: 'sandbox',
      paypalClientId: 'test-client-id',
      appUrl: 'http://localhost:5173',
      demoMode: false,
    });
    render(<PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />);
    expect(await screen.findByTestId('paypal-buttons')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve in mock PayPal' })).toBeNull();
  });

  it('shows the denial message when accept is denied', async () => {
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://localhost:5173',
      demoMode: true,
    });
    apiMock.post.mockResolvedValue({
      status: 'denied',
      reason: 'stale_version',
      message: 'Quote v1 was replaced by v2.',
    });
    render(<PayWithPayPal quoteId={quoteId} version={1} amountCents={8000} onPaid={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve in mock PayPal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote v1 was replaced by v2.');
    expect(navigationMock.assign).not.toHaveBeenCalled();
  });
});
