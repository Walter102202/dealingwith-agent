import { render, screen } from '@testing-library/react';
import type { AgWidgetParams } from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';
import { CENTS } from '../money.js';
import { column, summed } from '../test-fields.js';
import { fakeWidgetApi } from '../test-widget-api.js';
import type { BudgetMeterStyle, BudgetMeterWidget } from '../types.js';
import { meterParts } from './budget.js';

vi.mock('ag-studio-react', () => ({
  AgIncompleteDataMappingOverlay: () => null,
  AgNoDataOverlay: () => null,
}));

import { BudgetMeterComp } from './BudgetMeter.js';

const spent = summed('mandates.spentCents', CENTS);
const limit = summed('mandates.totalLimitCents', CENTS);
const perPurchase = summed('mandates.perPurchaseLimitCents', CENTS);
const status = column('mandates.status');
const expires = column('mandates.expiresOn');
const row = {
  [spent.key]: 6000,
  [limit.key]: 30000,
  [perPurchase.key]: 10000,
  [status.key]: 'active',
  [expires.key]: '2026-12-31',
};

function renderMeter(style?: BudgetMeterStyle) {
  const params = {
    dataMapping: {
      spent: [spent],
      limit: [limit],
      perPurchase: [perPurchase],
      status: [status],
      expires: [expires],
    },
    widgetApi: fakeWidgetApi([row]),
    ...(style ? { format: { style } } : {}),
  } as unknown as AgWidgetParams<BudgetMeterWidget>;
  return render(<BudgetMeterComp {...params} />);
}

const facts = () => screen.getAllByRole('term').map((dt) => dt.textContent);
const bar = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]');

describe('meterParts', () => {
  it('shows every part unless the style turns it off', () => {
    expect(meterParts(undefined)).toEqual({
      bar: true,
      perPurchase: true,
      status: true,
      expires: true,
    });
    expect(meterParts({ showBar: false, showStatus: false })).toEqual({
      bar: false,
      perPurchase: true,
      status: false,
      expires: true,
    });
  });
});

describe('BudgetMeterComp format.style', () => {
  it('shows the bar and every mapped detail by default', () => {
    const { container } = renderMeter();
    expect(screen.getByText('US$240.00')).toBeInTheDocument();
    expect(bar(container)).not.toBeNull();
    expect(facts()).toEqual(['Spent', 'Per purchase', 'Status', 'Expires']);
  });

  it('hides the bar when showBar is false', () => {
    const { container } = renderMeter({ showBar: false });
    expect(bar(container)).toBeNull();
    expect(screen.getByText('US$240.00')).toBeInTheDocument();
  });

  it.each([
    ['showPerPurchase', 'Per purchase'],
    ['showStatus', 'Status'],
    ['showExpires', 'Expires'],
  ] as const)('hides one detail when %s is false', (option, label) => {
    renderMeter({ [option]: false });
    expect(facts()).not.toContain(label);
    expect(facts()).toContain('Spent');
    expect(facts()).toHaveLength(3);
  });
});
