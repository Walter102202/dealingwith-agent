import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Money } from './Money.js';

describe('Money', () => {
  it('renders 8000 cents as US$80.00', () => {
    render(<Money cents={8000} />);
    expect(screen.getByText('US$80.00')).toBeInTheDocument();
  });

  it('renders 0 cents as US$0.00', () => {
    render(<Money cents={0} />);
    expect(screen.getByText('US$0.00')).toBeInTheDocument();
  });

  it('renders 123450 cents as US$1,234.50 with grouping', () => {
    render(<Money cents={123450} />);
    expect(screen.getByText('US$1,234.50')).toBeInTheDocument();
  });
});
