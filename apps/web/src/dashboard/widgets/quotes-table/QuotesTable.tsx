import {
  type CellClickedEvent,
  type CellKeyDownEvent,
  CellStyleModule,
  ClientSideRowModelModule,
  type Module,
  PinnedRowModule,
  type RowClassRules,
  RowStyleModule,
  ValidationModule,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { type AgWidgetParams, studioGridTheme } from 'ag-studio';
import { AgIncompleteDataMappingOverlay, AgNoDataOverlay } from 'ag-studio-react';
import { use, useMemo, useState } from 'react';
import type { QuotesTableWidget } from '../types.js';
import { buildColumns, fitColumns } from './columns.js';
import styles from './QuotesTable.module.css';
import {
  type CompleteTableFields,
  isComplete,
  mappedFields,
  queryFields,
  selectedValues,
  selectionTarget,
  type TableRow,
  toTableRows,
  totalCents,
} from './rows.js';
import { tableLayout } from './style.js';

type Params = AgWidgetParams<QuotesTableWidget>;

/** Only what the table uses, so the grid stays small; validation messages in development only. */
const MODULES: Module[] = [
  ClientSideRowModelModule,
  PinnedRowModule,
  RowStyleModule,
  CellStyleModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
];

const ROW_CLASSES: RowClassRules<TableRow> = {
  [styles.selectedRow ?? 'selected']: (p) => (p.data?.selected.length ?? 0) > 0,
  [styles.dimmedRow ?? 'dimmed']: (p) => p.data?.dimmed === true,
};

/**
 * "Quotes and additionals": an AG Grid inside a Studio widget. Rows come from
 * `widgetApi.getData`, so page filters and other widgets' cross filters apply;
 * a click on a row, a channel or a status cross-filters the rest of the page.
 */
export function QuotesTableComp(params: Params) {
  const fields = mappedFields(params.dataMapping);
  if (!isComplete(fields)) return <AgIncompleteDataMappingOverlay />;
  return <Table params={params} fields={fields} />;
}

function Table({ params, fields }: { params: Params; fields: CompleteTableFields }) {
  const { widgetApi, sort, format } = params;
  const query = queryFields(fields);
  const response = use(widgetApi.getData(sort ? { fields: query, sort } : { fields: query }));
  const selections = selectedValues(widgetApi.getCrossFilterSelections());
  const rows = toTableRows(response.results.rows, fields, selections, response.crossFilter?.rows);

  const layout = tableLayout(format?.style);
  const [width, setWidth] = useState<number | null>(null);
  const fit = fitColumns(width, fields);
  const signature = query.map((f) => f.key).join('|');
  const fitKey = `${fit.hidden.join(',')}|${fit.pinAmount}|${layout.showProject}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: columns change only when the mapped fields, the fit or the density do.
  const columns = useMemo(
    () =>
      buildColumns(fields, widgetApi.formatFieldValue, fit, { showProject: layout.showProject }),
    [signature, fitKey, widgetApi],
  );

  if (rows.length === 0) return <AgNoDataOverlay />;

  const total: TableRow = {
    id: 'total',
    values: {},
    amount: totalCents(rows),
    selected: [],
    dimmed: false,
  };

  const toggle = (row: TableRow | undefined, slot: string | undefined, multi: boolean) => {
    if (!row || row.id === 'total') return;
    const { field, value } = selectionTarget(slot, row, fields);
    widgetApi.toggleCrossFilter({ type: 'value', field, value, group: 0, reset: !multi });
  };
  const onCellClicked = (e: CellClickedEvent<TableRow>) => {
    if (e.rowPinned) return;
    const mouse = e.event instanceof MouseEvent ? e.event : null;
    toggle(e.data, e.column.getColId(), Boolean(mouse?.metaKey || mouse?.ctrlKey));
  };
  const onCellKeyDown = (e: CellKeyDownEvent<TableRow>) => {
    const key = e.event instanceof KeyboardEvent ? e.event : null;
    if (!key || e.rowPinned || (key.key !== 'Enter' && key.key !== ' ')) return;
    key.preventDefault();
    toggle(e.data, e.column.getColId(), key.metaKey || key.ctrlKey);
  };

  return (
    <div className={styles.table}>
      <AgGridReact<TableRow>
        theme={studioGridTheme}
        modules={MODULES}
        rowData={rows}
        columnDefs={columns}
        getRowId={(p) => p.data.id}
        pinnedBottomRowData={layout.totalRow ? [total] : []}
        rowClassRules={ROW_CLASSES}
        rowHeight={layout.rowHeight}
        headerHeight={layout.headerHeight}
        suppressDragLeaveHidesColumns
        onGridSizeChanged={(e) => setWidth(e.clientWidth)}
        onCellClicked={onCellClicked}
        onCellKeyDown={onCellKeyDown}
      />
    </div>
  );
}
