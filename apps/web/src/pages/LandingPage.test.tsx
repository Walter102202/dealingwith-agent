import { connectionSnippets, QuoteSchema } from '@dealingwith/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return { ...actual, api: { ...actual.api, get: apiMock.get } };
});
const sessionMock = vi.hoisted(() => ({ current: { session: null, status: 'ready' } as unknown }));
vi.mock('../session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../session.js')>();
  return { ...actual, useSession: () => sessionMock.current };
});

import { DEMO_QUOTES } from '../api/fixtures/quotes.js';
import { DEMO_QUOTE, DEMO_REQUEST } from '../landing/demo-quote.js';
import { renderWithProviders } from '../test/render.js';
import { LandingPage } from './LandingPage.js';

const config = { paypalMode: 'mock', appUrl: 'http://localhost:5173', demoMode: true };
const projectId = '00000000-0000-4000-8000-0000000000f1';

function signedIn(session: unknown) {
  sessionMock.current = { session, status: 'ready', loginAs: vi.fn(), logout: vi.fn() };
}

// Reduced motion: the replays render their final frame at once.
window.matchMedia = ((query: string) => ({
  matches: query.includes('reduce'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

describe('LandingPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    signedIn(null);
  });

  it('states the promise and sends a visitor to the demo doors', () => {
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Turn service requests into paid work.',
    );
    for (const link of screen.getAllByRole('link', { name: 'Try the live demo' })) {
      expect(link).toHaveAttribute('href', '/login');
    }
    expect(screen.getByRole('link', { name: /Browse the storefront/ })).toHaveAttribute(
      'href',
      '/store',
    );
  });

  it('shows the demo quote read-only: included at US$0.00, the extra at US$80.00, no payment button', async () => {
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    const quote = await screen.findByRole('article', { name: 'Quote v1' });
    expect(within(quote).getByText('US$0.00')).toBeInTheDocument();
    expect(within(quote).getByTestId('quote-total')).toHaveTextContent('US$80.00');
    expect(within(quote).queryByRole('button', { name: /PayPal/ })).toBeNull();
    expect(within(quote).queryByRole('button', { name: 'Ask for an adjustment' })).toBeNull();
  });

  it('replays the agent cases from the chips', async () => {
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    const panel = await screen.findByRole('tabpanel');
    expect(await within(panel).findByText('paid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '/over-limit' }));
    expect(await within(panel).findByText('approval_required')).toBeInTheDocument();
    expect(within(panel).getByText('US$190.00')).toBeInTheDocument();
  });

  it('sends a signed-in client to their project, with one projects request and no detour', async () => {
    signedIn({ role: 'client', name: 'Mara Keller' });
    let answer: (projects: unknown) => void = () => {};
    apiMock.get.mockImplementation((path: string) =>
      path === '/api/projects'
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(config),
    );
    renderWithProviders(<LandingPage />);
    // Until the project is known the call to action is not a link anywhere.
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith('/api/projects', expect.anything()),
    );
    expect(screen.queryAllByRole('link', { name: 'Open my project' })).toHaveLength(0);
    expect(screen.getAllByText('Open my project')).toHaveLength(2);
    answer([
      {
        id: projectId,
        businessId: '00000000-0000-4000-8000-0000000000f2',
        clientId: '00000000-0000-4000-8000-0000000000f3',
        serviceId: '00000000-0000-4000-8000-0000000000f4',
        title: 'Retail KPI dashboard',
        status: 'active',
        scopeClauses: [],
        totalContractedCents: 0,
      },
    ]);
    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: 'Open my project' });
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link).toHaveAttribute('href', `/portal/projects/${projectId}`);
      }
    });
    const projectCalls = apiMock.get.mock.calls.filter(([path]) => path === '/api/projects');
    expect(projectCalls).toHaveLength(1);
  });

  it('falls back to the demo doors when the projects request fails', async () => {
    signedIn({ role: 'client', name: 'Mara Keller' });
    apiMock.get.mockImplementation((path: string) =>
      path === '/api/projects' ? Promise.reject(new Error('offline')) : Promise.resolve(config),
    );
    renderWithProviders(<LandingPage />);
    await waitFor(() => {
      for (const link of screen.getAllByRole('link', { name: 'Open my project' })) {
        expect(link).toHaveAttribute('href', '/login');
      }
    });
  });

  it('signs straight in from the role doors', () => {
    const loginAs = vi.fn().mockResolvedValue(undefined);
    sessionMock.current = { session: null, status: 'ready', loginAs, logout: vi.fn() };
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: /Enter as Mara/ }));
    expect(loginAs).toHaveBeenCalledWith('client');
  });

  it('prints the same Claude Code command as the API', () => {
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    const { claudeCode } = connectionSnippets({ appUrl: window.location.origin, token: 'dwa_…' });
    expect(screen.getByText(claudeCode)).toBeInTheDocument();
  });

  it('sends a signed-in provider to the dashboard', () => {
    signedIn({ role: 'provider', businessId: 'b', name: 'Andes Data Studio' });
    apiMock.get.mockResolvedValue(config);
    renderWithProviders(<LandingPage />);
    expect(screen.getAllByRole('link', { name: 'Open dashboard' })[0]).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});

describe('DEMO_QUOTE', () => {
  it('is the fixture quote for demo request 1, paid', () => {
    const quote = QuoteSchema.parse(DEMO_QUOTE);
    expect(quote.status).toBe('paid');
    expect(quote.totalCents).toBe(8000);
    expect(quote.lineItems.map((line) => line.amountCents)).toEqual([0, 8000]);
    const key = Object.keys(DEMO_QUOTES).find((k) => DEMO_REQUEST.includes(k));
    expect(key && DEMO_QUOTES[key]?.lineItems).toEqual(quote.lineItems);
  });
});
