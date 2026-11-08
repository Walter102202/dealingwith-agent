import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get, post: apiMock.post } };
});
vi.mock('../session.js', () => ({
  useSession: () => ({
    session: { role: 'client', name: 'Mara Keller' },
    status: 'ready',
    loginAs: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { DEMO_IDS } from '../api/fixtures/demo-ids.js';
import { handlers } from '../api/fixtures/handlers.js';
import { hardResetState } from '../api/fixtures/state.js';
import { routes } from '../api/routes.js';
import { renderWithProviders } from '../test/render.js';
import { StorefrontPage } from './StorefrontPage.js';

const config = { paypalMode: 'mock', appUrl: 'http://localhost:5173', demoMode: true };

describe('StorefrontPage', () => {
  beforeEach(() => {
    hardResetState();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('after a zero-cost accept, refetches the quote and shows it as paid', async () => {
    const first = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    const accepted = await handlers.acceptQuote(first.id, { version: 1 });
    await handlers.captureOrder(accepted.payment?.paypalOrderId as string);
    const quote = await handlers.createRequest({
      text: 'Send the Monday summary to our regional managers too.',
    });
    expect(quote.totalCents).toBe(0);

    apiMock.get.mockImplementation(async (path: string) => {
      if (path === routes.config) return config;
      if (path === routes.services) return handlers.services();
      if (path === routes.quotes.get(quote.id, 1)) return { ...quote, status: 'paid' };
      throw new Error(`unexpected GET ${path}`);
    });
    apiMock.post.mockImplementation(async (path: string) => {
      if (path === routes.requests.create) return quote;
      if (path === routes.quotes.accept(quote.id))
        return { status: 'paid', message: 'Nothing to pay.' };
      throw new Error(`unexpected POST ${path}`);
    });

    renderWithProviders(<StorefrontPage />);
    fireEvent.change(await screen.findByLabelText('Describe what you need'), {
      target: { value: 'Send the Monday summary to our regional managers too.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Get a quote' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at no cost' }));

    await waitFor(() => {
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Accept at no cost' })).not.toBeInTheDocument();
  });
});
