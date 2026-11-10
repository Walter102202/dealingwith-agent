import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render.js';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get, post: apiMock.post } };
});

const sessionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../session.js', () => ({ useSession: () => sessionMock.current }));

const navigationMock = vi.hoisted(() => ({ assign: vi.fn(), reload: vi.fn() }));
vi.mock('../lib/navigation.js', () => navigationMock);

import { Layout } from './Layout.js';

const provider = {
  session: { role: 'provider', businessId: 'a0000000-0000-4000-8000-000000000001', name: 'Andes' },
  status: 'ready',
  loginAs: vi.fn(),
  logout: vi.fn(),
};
const client = {
  ...provider,
  session: {
    ...provider.session,
    role: 'client',
    clientId: 'a0000000-0000-4000-8000-000000000021',
  },
};

const renderLayout = () =>
  renderWithProviders(
    <Layout>
      <p>body</p>
    </Layout>,
  );

describe('Layout reset demo data', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows Reset demo data to the provider in demo mode and resets after confirmation', async () => {
    sessionMock.current = provider;
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://x',
      demoMode: true,
      assistant: { enabled: false },
    });
    apiMock.post.mockResolvedValue({ ok: true });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderLayout();
    const button = await screen.findByRole('button', { name: 'Reset demo data' });
    fireEvent.click(button);
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/api/demo/reset', {}, expect.anything()),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      'This restores the demo to its starting state. Continue?',
    );
    expect(navigationMock.reload).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is declined', async () => {
    sessionMock.current = provider;
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://x',
      demoMode: true,
      assistant: { enabled: false },
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset demo data' }));
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('hides the button for clients and outside demo mode', async () => {
    sessionMock.current = client;
    apiMock.get.mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://x',
      demoMode: true,
      assistant: { enabled: false },
    });
    const first = renderLayout();
    await screen.findByText('body');
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull();
    first.unmount();

    sessionMock.current = provider;
    apiMock.get.mockResolvedValue({
      paypalMode: 'sandbox',
      paypalClientId: 'x',
      appUrl: 'http://x',
      demoMode: false,
      assistant: { enabled: false },
    });
    renderLayout();
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull();
  });
});
