import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlers } from '../api/fixtures/handlers.js';
import { hardResetState } from '../api/fixtures/state.js';

const sessionMock = vi.hoisted(() => ({ name: 'Andes Data Studio' }));
vi.mock('../session.js', () => ({
  useSession: () => ({
    session: { role: 'provider', businessId: 'business', name: sessionMock.name },
    status: 'ready',
  }),
}));
vi.mock('../components/Layout.js', () => ({
  Layout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(async () => handlers.dashboardData()) },
  errorMessage: String,
}));

/** What the page hands Studio, and a fake Studio API the page drives. */
const studio = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  state: { selectedPageId: '' } as { selectedPageId: string },
  setState: (() => undefined) as (state: { selectedPageId: string }) => void,
}));
vi.mock('ag-studio-react', () => ({
  AgStudioProvider: ({ children }: { children: ReactNode }) => children,
  AgStudio: (props: Record<string, unknown>) => {
    studio.props = props;
    const onApiReady = props.onApiReady as (event: { api: unknown }) => void;
    useEffect(() => {
      onApiReady({ api: { getState: () => studio.state, setState: studio.setState } });
    }, [onApiReady]);
    return null;
  },
}));

import { DASHBOARD_PAGES, DASHBOARD_STATE } from '../dashboard/studio-config.js';
import DashboardPage from './DashboardPage.js';

beforeEach(() => {
  hardResetState();
  studio.props = {};
  studio.state = { selectedPageId: DASHBOARD_STATE.selectedPageId };
  studio.setState = vi.fn((state) => {
    studio.state = state;
  });
});

describe('DashboardPage header', () => {
  it.each(['Andes Data Studio', 'Other Studio'])('uses the provider session name: %s', (name) => {
    sessionMock.name = name;
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
  });

  it('leaves the mandate budget to the Agent budget widget', async () => {
    render(<DashboardPage />);
    await screen.findByRole('navigation', { name: 'Dashboard pages' });
    expect(screen.queryByText(/mandate budget left/i)).not.toBeInTheDocument();
  });
});

describe('DashboardPage studio', () => {
  it('opens as a report on the first page, responsive, with the custom widgets', async () => {
    render(<DashboardPage />);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-pressed', 'false');
    expect(studio.props.mode).toBe('view');
    expect(studio.props.initialState).toBe(DASHBOARD_STATE);
    expect(studio.props.responsiveLayoutBreakpoints).toHaveLength(2);
    expect(typeof studio.props.widgets).toBe('function');
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches Studio between read and edit mode from the Edit toggle', async () => {
    render(<DashboardPage />);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(edit);
    expect(edit).toHaveAttribute('aria-pressed', 'true');
    expect(studio.props.mode).toBe('edit');
    fireEvent.click(edit);
    expect(studio.props.mode).toBe('view');
  });

  it('selects a page through the Studio API and marks its tab', async () => {
    render(<DashboardPage />);
    const nav = await screen.findByRole('navigation', { name: 'Dashboard pages' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(DASHBOARD_PAGES.map((p) => p.title));
    const collections = DASHBOARD_PAGES[1];
    fireEvent.click(within(nav).getByRole('button', { name: collections.title }));
    expect(studio.setState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPageId: collections.id }),
    );
    expect(within(nav).getByRole('button', { name: collections.title })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
