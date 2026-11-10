import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get, post: apiMock.post } };
});
vi.mock('../session.js', () => ({
  useSession: () => ({ session: null, status: 'ready', loginAs: vi.fn(), logout: vi.fn() }),
}));

import { ApiRequestError } from '../api/errors.js';
import { PayReturnPage } from './PayReturnPage.js';

const quoteId = 'b0000000-0000-4000-8000-000000000001';
const projectId = 'a0000000-0000-4000-8000-000000000031';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/pay/return" element={<PayReturnPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PayReturnPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([true, false])(
    'captures the order and links to its origin (project: %s)',
    async (hasProject) => {
      apiMock.post.mockResolvedValue({
        id: 'd0000000-0000-4000-8000-000000000001',
        quoteId,
        quoteVersion: 1,
        mode: 'pay_now',
        paypalOrderId: 'MOCK-ORDER-000001',
        paypalCaptureId: 'MOCK-CAPTURE-000001',
        amountCents: 8000,
        currency: 'USD',
        status: 'captured',
        createdAt: '2026-11-08T15:00:00.000Z',
      });
      apiMock.get.mockResolvedValue({
        id: quoteId,
        requestId: 'c0000000-0000-4000-8000-000000000001',
        ...(hasProject ? { projectId } : {}),
        version: 1,
        status: 'paid',
        lineItems: [],
        subtotalCents: 8000,
        totalCents: 8000,
        currency: 'USD',
        explanation: '',
        deliveryDays: 1,
        needsInfo: [],
      });
      renderAt('/pay/return?token=MOCK-ORDER-000001&PayerID=MOCKPAYER01');
      expect(
        await screen.findByText('Paid US$80.00 · Quote v1 · Capture id MOCK-CAPTURE-000001'),
      ).toBeInTheDocument();
      expect(apiMock.post).toHaveBeenCalledWith(
        '/api/paypal/orders/MOCK-ORDER-000001/capture',
        {},
        expect.anything(),
      );
      const back = await screen.findByRole('link', {
        name: hasProject ? 'Back to project' : 'Back to the storefront',
      });
      expect(back).toHaveAttribute('href', hasProject ? `/portal/projects/${projectId}` : '/store');
    },
  );

  it('shows the API error message when the capture fails', async () => {
    apiMock.post.mockRejectedValue(
      new ApiRequestError(502, 'paypal_error', 'PayPal declined the capture.'),
    );
    renderAt('/pay/return?token=MOCK-ORDER-000009');
    expect(await screen.findByRole('alert')).toHaveTextContent('PayPal declined the capture.');
  });

  it('explains when the token is missing', () => {
    renderAt('/pay/return');
    expect(screen.getByRole('alert')).toHaveTextContent('This link has no PayPal order.');
  });
});
