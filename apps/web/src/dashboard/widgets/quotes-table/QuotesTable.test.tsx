import { render, screen } from '@testing-library/react';
import type { AgWidgetParams } from 'ag-studio';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CENTS } from '../money.js';
import { column, summed } from '../test-fields.js';
import { fakeWidgetApi } from '../test-widget-api.js';
import type { QuotesTableStyle, QuotesTableWidget } from '../types.js';
import { buildColumns } from './columns.js';
import { tableLayout } from './style.js';

/** What the table hands AG Grid; the grid itself is not rendered in jsdom. */
const grid = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    grid.props = props;
    return <div>grid</div>;
  },
}));
vi.mock('ag-studio-react', () => ({
  AgIncompleteDataMappingOverlay: () => null,
  AgNoDataOverlay: () => null,
}));

import { QuotesTableComp } from './QuotesTable.js';

const fields = {
  client: column('lines.clientName'),
  project: column('lines.projectTitle'),
  line: column('lines.label'),
  amount: summed('lines.amountCents', CENTS),
};
const rows = [
  {
    'lines.clientName': 'Mara Lopez',
    'lines.projectTitle': 'Q4 dashboard',
    'lines.label': 'Extra report pages',
    'lines.amountCents:sum': 12000,
  },
];

async function renderTable(style?: QuotesTableStyle) {
  const params = {
    dataMapping: {
      client: [fields.client],
      project: [fields.project],
      line: [fields.line],
      amount: [fields.amount],
    },
    widgetApi: fakeWidgetApi(rows),
    ...(style ? { format: { style } } : {}),
  } as unknown as AgWidgetParams<QuotesTableWidget>;
  render(
    <Suspense fallback={null}>
      <QuotesTableComp {...params} />
    </Suspense>,
  );
  await screen.findByText('grid');
}

describe('tableLayout', () => {
  it('draws comfortable rows with the project line and a total row by default', () => {
    expect(tableLayout(undefined)).toEqual({
      rowHeight: 44,
      headerHeight: 38,
      totalRow: true,
      showProject: true,
    });
  });

  it('draws compact single-line rows when the density is compact', () => {
    expect(tableLayout({ density: 'compact' })).toMatchObject({
      rowHeight: 32,
      headerHeight: 32,
      showProject: false,
    });
  });

  it('drops the total row only when it is turned off', () => {
    expect(tableLayout({ totalRow: false }).totalRow).toBe(false);
    expect(tableLayout({ totalRow: true }).totalRow).toBe(true);
  });
});

describe('buildColumns showProject', () => {
  const complete = { ...fields };
  const clientParams = (showProject: boolean) =>
    buildColumns(complete, () => '', undefined, { showProject }).find((c) => c.colId === 'client')
      ?.cellRendererParams;

  it('puts the project under the client only when asked to', () => {
    expect(clientParams(true)).toHaveProperty('project', fields.project);
    expect(clientParams(false)).not.toHaveProperty('project');
  });
});

describe('QuotesTableComp format.style', () => {
  it('renders comfortable rows with a total row when no style is set', async () => {
    await renderTable();
    expect(grid.props.rowHeight).toBe(44);
    expect(grid.props.headerHeight).toBe(38);
    expect(grid.props.pinnedBottomRowData).toEqual([
      expect.objectContaining({ id: 'total', amount: 12000 }),
    ]);
  });

  it('honours compact density and a hidden total row', async () => {
    await renderTable({ density: 'compact', totalRow: false });
    expect(grid.props.rowHeight).toBe(32);
    expect(grid.props.headerHeight).toBe(32);
    expect(grid.props.pinnedBottomRowData).toEqual([]);
    const columns = grid.props.columnDefs as { colId: string; cellRendererParams: object }[];
    expect(columns.find((c) => c.colId === 'client')?.cellRendererParams).not.toHaveProperty(
      'project',
    );
  });
});
