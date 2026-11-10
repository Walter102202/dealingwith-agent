import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReminderDraftCard } from './ReminderDraftCard.js';

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

describe('ReminderDraftCard', () => {
  it('shows the whole draft at once, amounts formatted from cents', () => {
    render(<ReminderDraftCard reminder={reminder} onDismiss={() => undefined} />);
    const card = screen.getByRole('complementary', { name: 'Reminder draft from the assistant' });
    expect(card).toHaveTextContent('Payment reminder for Mara Lopez');
    const draft = within(card).getByRole('region', {
      name: 'Payment reminder draft for Mara Lopez',
    });
    expect(draft).toHaveTextContent('Hi Mara,');
    expect(draft).toHaveTextContent('Rush deliveryQ-9B1E4D20 v2US$45.50');
    expect(draft).toHaveTextContent('Total dueUS$165.50');
    expect(draft).toHaveTextContent('Nothing has been sent.');
  });

  it('closes from Dismiss', () => {
    const onDismiss = vi.fn();
    render(<ReminderDraftCard reminder={reminder} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
