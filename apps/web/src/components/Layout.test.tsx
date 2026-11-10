import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

describe('Layout menu on phones', () => {
  const config = {
    paypalMode: 'mock',
    appUrl: 'http://x',
    demoMode: true,
    assistant: { enabled: false },
  };
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const openMenu = () => {
    const button = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(button);
    return button;
  };

  it('puts every session action in the panel the Menu button controls', async () => {
    sessionMock.current = provider;
    apiMock.get.mockResolvedValue(config);
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    if (!panel) throw new Error('the Menu button controls no element');
    const actions = within(panel);
    expect(actions.getByRole('link', { name: 'Storefront' })).toBeInTheDocument();
    expect(actions.getByText('Andes')).toBeInTheDocument();
    expect(actions.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await actions.findByRole('button', { name: 'Reset demo data' })).toBeInTheDocument();
    expect(actions.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and gives focus back to the Menu button', () => {
    sessionMock.current = client;
    apiMock.get.mockResolvedValue(config);
    renderLayout();
    const button = openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a press outside the header and once an action is chosen', () => {
    sessionMock.current = provider;
    apiMock.get.mockResolvedValue(config);
    renderLayout();
    const button = openMenu();
    fireEvent.pointerDown(screen.getByText('body'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    openMenu();
    fireEvent.pointerDown(screen.getByRole('link', { name: 'Dashboard' }));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the menu open while resetting and reopens it with the alert when the reset fails', async () => {
    sessionMock.current = provider;
    apiMock.get.mockResolvedValue(config);
    let fail: (error: Error) => void = () => undefined;
    apiMock.post.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderLayout();
    const button = openMenu();
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    if (!panel) throw new Error('the Menu button controls no element');
    fireEvent.click(await within(panel).findByRole('button', { name: 'Reset demo data' }));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // A press outside while the request runs closes the menu; the failure must still be seen.
    fireEvent.pointerDown(screen.getByText('body'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await act(async () => fail(new Error('The demo could not be reset.')));
    expect(within(panel).getByRole('alert')).toHaveTextContent('The demo could not be reset.');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(navigationMock.reload).not.toHaveBeenCalled();
  });

  it('offers the signed-out visitor the storefront and the demo sign in', () => {
    sessionMock.current = { session: null, status: 'ready', loginAs: vi.fn(), logout: vi.fn() };
    apiMock.get.mockResolvedValue(config);
    renderLayout();
    const button = openMenu();
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    if (!panel) throw new Error('the Menu button controls no element');
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Storefront', 'Demo sign in']);
  });
});
