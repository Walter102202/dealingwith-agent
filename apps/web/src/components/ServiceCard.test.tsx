import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SERVICES } from '../api/fixtures/state.js';
import { ServiceCard } from './ServiceCard.js';

describe('ServiceCard money', () => {
  it('formats every fixed rule in a multi-rule summary with cents', () => {
    const service = SERVICES[1];
    if (!service) throw new Error('Missing automation fixture');
    render(<ServiceCard service={service} />);
    expect(screen.getByText(/US\$80\.00/)).toHaveTextContent('US$60.00');
  });

  it('renders a single fixed price once with cents and thousands separators', () => {
    const service = SERVICES[0];
    if (!service) throw new Error('Missing dashboard fixture');
    render(<ServiceCard service={service} />);
    expect(screen.getAllByText('US$1,200.00')).toHaveLength(1);
    expect(screen.queryByText('US$1,200', { exact: true })).toBeNull();
  });
});
