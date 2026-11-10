import { render, screen } from '@testing-library/react';
import type { AgWidgetParams } from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';
import { CENTS } from '../money.js';
import { column, summed } from '../test-fields.js';
import { fakeWidgetApi } from '../test-widget-api.js';
import type { KpiTileStyle, KpiTileWidget } from '../types.js';
import styles from './KpiTile.module.css';
import { tileLayout } from './kpi.js';

vi.mock('ag-studio-react', () => ({ AgIncompleteDataMappingOverlay: () => null }));

import { KpiTileComp } from './KpiTile.js';

const value = summed('lines.amountCents', CENTS);
const count = { ...column('lines.quoteId'), key: 'lines.quoteId:countd' } as typeof value;
const row = { [value.key]: 25000, [count.key]: 2 };

function renderTile(style?: KpiTileStyle) {
  const params = {
    dataMapping: { value: [value], count: [count] },
    widgetApi: fakeWidgetApi([row]),
    format: { style: { countOne: 'quote waiting', countMany: 'quotes waiting', ...style } },
  } as unknown as AgWidgetParams<KpiTileWidget>;
  render(<KpiTileComp {...params} />);
}

describe('tileLayout', () => {
  it('shows the count at the regular size by default', () => {
    expect(tileLayout(undefined)).toEqual({ showCount: true, valueSize: 'regular' });
    expect(tileLayout({ showCount: false, valueSize: 'large' })).toEqual({
      showCount: false,
      valueSize: 'large',
    });
  });
});

describe('KpiTileComp format.style', () => {
  it('shows the value from cents and the count line by default', () => {
    renderTile();
    expect(screen.getByText('US$250.00')).toHaveClass(styles.value ?? 'value');
    expect(screen.getByText('2 quotes waiting')).toBeInTheDocument();
  });

  it('hides the count line when showCount is false', () => {
    renderTile({ showCount: false });
    expect(screen.getByText('US$250.00')).toBeInTheDocument();
    expect(screen.queryByText('2 quotes waiting')).not.toBeInTheDocument();
  });

  it.each(['compact', 'large'] as const)('sizes the value %s', (valueSize) => {
    renderTile({ valueSize });
    const sized = styles[valueSize];
    expect(sized).toBeTruthy();
    expect(screen.getByText('US$250.00')).toHaveClass(sized ?? valueSize);
  });

  it('adds no size class at the regular size', () => {
    renderTile({ valueSize: 'regular' });
    const valueEl = screen.getByText('US$250.00');
    expect(valueEl).not.toHaveClass(styles.compact ?? 'compact');
    expect(valueEl).not.toHaveClass(styles.large ?? 'large');
  });
});
