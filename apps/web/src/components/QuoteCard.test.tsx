import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render.js';

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(async () => ({
        paypalMode: 'mock',
        appUrl: 'http://localhost:5173',
        demoMode: true,
        assistant: { enabled: false },
      })),
      post: vi.fn(),
    },
  };
});

import { DEMO_QUOTES } from '../api/fixtures/quotes.js';
import { QuoteCard } from './QuoteCard.js';

const requestOne = DEMO_QUOTES['summary email every Monday'];
const needsInfo = DEMO_QUOTES['load faster'];
if (!requestOne || !needsInfo) throw new Error('fixtures missing');

const noop = async () => {};

describe('QuoteCard', () => {
  it('renders repeated rule labels without duplicate keys', () => {
    const line = requestOne.lineItems.find((item) => item.kind === 'rule');
    if (!line) throw new Error('Missing rule fixture');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderWithProviders(
        <QuoteCard
          quote={{
            ...requestOne,
            status: 'paid',
            lineItems: [
              { ...line, label: 'Additional data source' },
              { ...line, label: 'Additional data source' },
            ],
          }}
          onAccept={noop}
          onAdjust={noop}
          onAnswers={noop}
        />,
      );
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(
        log.mock.calls.some((call) => call.some((value) => String(value).includes('same key'))),
      ).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
  it('shows included and extra lines, delivery, total and both actions for a published quote', () => {
    renderWithProviders(
      <QuoteCard quote={requestOne} onAccept={noop} onAdjust={noop} onAnswers={noop} />,
    );
    expect(screen.getByRole('heading', { name: 'Quote v1' })).toBeInTheDocument();
    const included = screen.getByText('Per-branch view').closest('li');
    expect(included).not.toBeNull();
    expect(within(included as HTMLElement).getByText('Included')).toBeInTheDocument();
    expect(within(included as HTMLElement).getByText('US$0.00')).toBeInTheDocument();
    const extra = screen.getByText('Weekly Monday summary email').closest('li');
    expect(within(extra as HTMLElement).getByText('US$80.00')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('US$80.00');
    expect(screen.getByRole('button', { name: 'Ask for an adjustment' })).toBeInTheDocument();
    expect(screen.getByText('Accept quote v1')).toBeInTheDocument();
  });

  it('expands a line to show the rule it cites', () => {
    renderWithProviders(
      <QuoteCard quote={requestOne} onAccept={noop} onAdjust={noop} onAnswers={noop} />,
    );
    const extra = screen.getByText('Weekly Monday summary email').closest('li') as HTMLElement;
    fireEvent.click(within(extra).getByText('Why this line'));
    expect(within(extra).getByText('Rule S2.report.v1')).toBeInTheDocument();
    const included = screen.getByText('Per-branch view').closest('li') as HTMLElement;
    fireEvent.click(within(included).getByText('Why this line'));
    expect(within(included).getByText('Source: clause C1')).toBeInTheDocument();
  });

  it('renders the questions and "Send answers" for a needs-info quote', () => {
    renderWithProviders(
      <QuoteCard quote={needsInfo} onAccept={noop} onAdjust={noop} onAnswers={noop} />,
    );
    expect(
      screen.getByLabelText('Is the slowness caused by data volume or by the dashboard design?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send answers' })).toBeInTheDocument();
    expect(screen.queryByText(/^Accept quote v/)).toBeNull();
  });

  it('posts the adjustment text through onAdjust', async () => {
    const onAdjust = vi.fn(async () => {});
    renderWithProviders(
      <QuoteCard quote={requestOne} onAccept={noop} onAdjust={onAdjust} onAnswers={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ask for an adjustment' }));
    fireEvent.change(screen.getByLabelText('What should change?'), {
      target: { value: 'Send it on Tuesdays instead' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(onAdjust).toHaveBeenCalledWith('Send it on Tuesdays instead');
  });

  it('preview shows lines, sources and total with no actions', () => {
    renderWithProviders(<QuoteCard quote={requestOne} preview />);
    expect(screen.getByTestId('quote-total')).toHaveTextContent('US$80.00');
    expect(screen.queryByText(/^Accept quote v/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask for an adjustment' })).toBeNull();
    const extra = screen.getByText('Weekly Monday summary email').closest('li') as HTMLElement;
    fireEvent.click(within(extra).getByText('Why this line'));
    expect(within(extra).getByText('Rule S2.report.v1')).toBeInTheDocument();
  });

  it('names the agent that accepted the quote, and nothing when a person did', () => {
    const { unmount } = renderWithProviders(
      <QuoteCard quote={requestOne} acceptedBy="Mara's assistant" preview />,
    );
    expect(screen.getByText('Accepted by')).toBeInTheDocument();
    expect(screen.getByText("Mara's assistant")).toBeInTheDocument();
    unmount();
    renderWithProviders(<QuoteCard quote={requestOne} preview />);
    expect(screen.queryByText('Accepted by')).toBeNull();
  });

  it('preview of a needs-info quote shows the explanation without the form', () => {
    renderWithProviders(<QuoteCard quote={needsInfo} preview />);
    expect(screen.queryByRole('button', { name: 'Send answers' })).toBeNull();
  });
});
