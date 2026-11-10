import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASSISTANT_TOOL_DISPLAY, ReminderDetail } from './ReminderDetail.js';

const reminder = {
  clientName: 'Mara Lopez',
  greeting: 'Hi Mara,',
  message: 'Thanks for the extra work.',
  signOff: 'Best, Andes',
  lines: [
    { quoteRef: 'Q-7F3A2C10 v1', label: 'Extra report pages', amountCents: 12000 },
    { quoteRef: 'Q-9B1E4D20 v2', label: 'Rush delivery', amountCents: 4550 },
  ],
  totalCents: 16550,
};

describe('ReminderDetail', () => {
  it('shows the draft with amounts formatted from cents', () => {
    render(
      <ReminderDetail
        name="draft_payment_reminder"
        args={{}}
        status="done"
        result={{ success: true, response: 'ok', data: reminder }}
      />,
    );
    const draft = screen.getByRole('region', { name: 'Payment reminder draft for Mara Lopez' });
    expect(draft).toHaveTextContent('Q-7F3A2C10 v1');
    expect(draft).toHaveTextContent('US$120.00');
    expect(draft).toHaveTextContent('Total dueUS$165.50');
    expect(draft).toHaveTextContent('Nothing has been sent.');
  });

  it('counts the clients that owe in the lookup row', () => {
    const label = ASSISTANT_TOOL_DISPLAY.list_unpaid_additionals?.label;
    const params = (clients: number) => ({
      args: {},
      status: 'done' as const,
      result: { success: true as const, response: '', data: { clients } },
      fieldName: () => undefined,
      widgetName: () => undefined,
      tableName: () => undefined,
    });
    expect(label?.(params(1))).toEqual({ text: 'Looking up unpaid additionals', pill: '1 client' });
    expect(label?.(params(3))).toMatchObject({ pill: '3 clients' });
  });

  it('waits while the call is running and labels the row from the result', () => {
    render(
      <ReminderDetail
        name="draft_payment_reminder"
        args={{}}
        status="executing"
        result={undefined}
      />,
    );
    expect(screen.getByText('Drafting the reminder…')).toBeInTheDocument();
    const label = ASSISTANT_TOOL_DISPLAY.draft_payment_reminder?.label;
    const resolve = {
      fieldName: () => undefined,
      widgetName: () => undefined,
      tableName: () => undefined,
    };
    expect(
      label?.({
        args: { clientName: 'Mara Lopez' },
        status: 'done',
        result: { success: true, response: '', data: reminder },
        ...resolve,
      }),
    ).toEqual({ text: 'Payment reminder for Mara Lopez', pill: 'US$165.50' });
    expect(label?.({ args: { clientName: 'Mara' }, status: 'streaming', ...resolve })).toEqual({
      text: 'Drafting a reminder for Mara',
    });
  });
});
