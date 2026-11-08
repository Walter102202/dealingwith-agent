import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
      render(
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
    render(<QuoteCard quote={requestOne} onAccept={noop} onAdjust={noop} onAnswers={noop} />);
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
    expect(screen.getByText('Accept and pay with PayPal')).toBeInTheDocument();
  });

  it('expands a line to show the rule it cites', () => {
    render(<QuoteCard quote={requestOne} onAccept={noop} onAdjust={noop} onAnswers={noop} />);
    const extra = screen.getByText('Weekly Monday summary email').closest('li') as HTMLElement;
    fireEvent.click(within(extra).getByText('Why this line'));
    expect(within(extra).getByText('Rule S2.report.v1')).toBeInTheDocument();
    const included = screen.getByText('Per-branch view').closest('li') as HTMLElement;
    fireEvent.click(within(included).getByText('Why this line'));
    expect(within(included).getByText('Source: clause C1')).toBeInTheDocument();
  });

  it('renders the questions and "Send answers" for a needs-info quote', () => {
    render(<QuoteCard quote={needsInfo} onAccept={noop} onAdjust={noop} onAnswers={noop} />);
    expect(
      screen.getByLabelText('Is the slowness caused by data volume or by the dashboard design?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send answers' })).toBeInTheDocument();
    expect(screen.queryByText('Accept and pay with PayPal')).toBeNull();
  });

  it('posts the adjustment text through onAdjust', async () => {
    const onAdjust = vi.fn(async () => {});
    render(<QuoteCard quote={requestOne} onAccept={noop} onAdjust={onAdjust} onAnswers={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask for an adjustment' }));
    fireEvent.change(screen.getByLabelText('What should change?'), {
      target: { value: 'Send it on Tuesdays instead' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(onAdjust).toHaveBeenCalledWith('Send it on Tuesdays instead');
  });
});
