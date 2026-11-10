import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
/** What `/api/config` decides: `{}` when the assistant is off, its Studio props when on. */
const assistantMock = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  onDraft: undefined as ((reminder: unknown) => void) | undefined,
}));
vi.mock('../dashboard/assistant/useDashboardAssistant.js', () => ({
  useDashboardAssistant: (_data: unknown, onDraft: (reminder: unknown) => void) => {
    assistantMock.onDraft = onDraft;
    return assistantMock.props;
  },
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

import {
  ASSISTANT_PANELS,
  DASHBOARD_PAGES,
  DASHBOARD_PANELS,
  DASHBOARD_STATE,
} from '../dashboard/studio-config.js';
import DashboardPage from './DashboardPage.js';

beforeEach(() => {
  hardResetState();
  assistantMock.props = {};
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

  it('offers no Assistant toggle when the server has the assistant off', async () => {
    render(<DashboardPage />);
    await screen.findByRole('button', { name: 'Edit' });
    expect(screen.queryByRole('button', { name: 'Assistant' })).not.toBeInTheDocument();
    expect(studio.props.ai).toBeUndefined();
  });

  it('shows a finished reminder draft above the report until it is dismissed', async () => {
    assistantMock.props = { ai: () => null, modules: [] };
    render(<DashboardPage />);
    await screen.findByRole('button', { name: 'Assistant' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    act(() =>
      assistantMock.onDraft?.({
        clientName: 'Mara Lopez',
        greeting: 'Hi Mara,',
        message: 'Thanks for the extra work.',
        signOff: 'Best, Andes',
        lines: [{ quoteRef: 'Q-7F3A2C10 v1', label: 'Extra report pages', amountCents: 12000 }],
        totalCents: 12000,
      }),
    );
    const card = screen.getByRole('complementary', { name: 'Reminder draft from the assistant' });
    expect(card).toHaveTextContent('Total dueUS$120.00');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Payment reminder for Mara Lopez is ready above the report.',
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('opens the assistant beside the report: Studio edit mode with only the AI panel', async () => {
    const ai = () => null;
    assistantMock.props = { ai, modules: [] };
    render(<DashboardPage />);
    const assistant = await screen.findByRole('button', { name: 'Assistant' });
    expect(studio.props.ai).toBe(ai);
    expect(studio.props.panels).toBe(DASHBOARD_PANELS);
    fireEvent.click(assistant);
    expect(assistant).toHaveAttribute('aria-pressed', 'true');
    expect(studio.props.mode).toBe('edit');
    expect(studio.props.panels).toBe(ASSISTANT_PANELS);
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(edit);
    expect(assistant).toHaveAttribute('aria-pressed', 'false');
    expect(studio.props.panels).toBe(DASHBOARD_PANELS);
    fireEvent.click(edit);
    expect(studio.props.mode).toBe('view');
  });
});
