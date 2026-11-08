import type { Quote, ScopeClause } from '@dealingwith/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEMO_QUOTES } from '../api/fixtures/quotes.js';
import { ScopeList } from './ScopeList.js';

const clauses: ScopeClause[] = [
  {
    id: 'C1',
    text: 'Five views including a per-branch view',
    included: true,
    source: { kind: 'contract' },
  },
  {
    id: 'C2',
    text: 'Automations, scheduled emails and alerts',
    included: false,
    source: { kind: 'contract' },
  },
  { id: 'C3', text: 'One data source: Shopify', included: true, source: { kind: 'contract' } },
  {
    id: 'C4',
    text: 'Weekly Monday summary email',
    included: true,
    source: { kind: 'quote', quoteId: 'b0000000-0000-4000-8000-000000000001', version: 1 },
  },
];

const paidQuote = {
  ...(DEMO_QUOTES['summary email every Monday'] as Quote),
  status: 'paid' as const,
  paidAt: '2026-11-08T15:00:00.000Z',
};

describe('ScopeList', () => {
  it('separates contract clauses from paid additionals and marks exclusions', () => {
    render(<ScopeList clauses={clauses} quotes={[paidQuote]} />);
    const contract = screen.getByRole('list', { name: 'Contracted scope' });
    expect(within(contract).getAllByRole('listitem')).toHaveLength(3);
    const paid = screen.getByRole('list', { name: 'Paid additionals' });
    expect(within(paid).getAllByRole('listitem')).toHaveLength(1);
    expect(within(paid).getByText('Added from quote v1 on 8 Nov 2026')).toBeInTheDocument();
    const c2 = within(contract).getByText('Automations, scheduled emails and alerts').closest('li');
    expect(within(c2 as HTMLElement).getByText('Excluded')).toBeInTheDocument();
  });

  it('says so when nothing has been added yet', () => {
    render(<ScopeList clauses={clauses.slice(0, 3)} />);
    expect(screen.getByText('Nothing added yet. Paid quotes appear here.')).toBeInTheDocument();
  });
});
