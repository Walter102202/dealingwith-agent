import type { ColDef } from 'ag-grid-community';
import type { AgWidgetField } from 'ag-studio';
import {
  AmountCell,
  type CellParams,
  ChannelCell,
  ClientCell,
  RuleCell,
  StatusCell,
  TextCell,
} from './cells.js';
import type { CompleteTableFields, TableRow, TableSlot } from './rows.js';

type Format = CellParams['format'];

interface ColumnSpec {
  slot: TableSlot | 'amount';
  header: string;
  cellRenderer: ColDef<TableRow>['cellRenderer'];
  flex: number;
  minWidth: number;
  numeric?: boolean;
}

/** The visible columns, in order. `quote` and `project` are not columns of their own. */
const SPECS: ColumnSpec[] = [
  { slot: 'client', header: 'Client', cellRenderer: ClientCell, flex: 1.4, minWidth: 150 },
  { slot: 'line', header: 'Line', cellRenderer: TextCell, flex: 2, minWidth: 180 },
  { slot: 'rule', header: 'Rule', cellRenderer: RuleCell, flex: 1, minWidth: 110 },
  { slot: 'channel', header: 'Channel', cellRenderer: ChannelCell, flex: 0.8, minWidth: 96 },
  { slot: 'status', header: 'Status', cellRenderer: StatusCell, flex: 0.9, minWidth: 112 },
  {
    slot: 'amount',
    header: 'Amount',
    cellRenderer: AmountCell,
    flex: 0.9,
    minWidth: 108,
    numeric: true,
  },
];

/** Which columns a table of a given width shows. */
export interface ColumnFit {
  hidden: readonly TableSlot[];
  /** Keeps the amount in view while the other columns scroll sideways. */
  pinAmount: boolean;
}

/** The columns a narrow table gives up first; the line and the amount always stay. */
const DROP_ORDER: readonly TableSlot[] = ['rule', 'channel', 'client', 'status'];
/** Room for the grid's vertical scrollbar. */
const SCROLLBAR = 16;

/**
 * Drops columns in `DROP_ORDER` until the rest fit at their minimum widths,
 * and pins the amount to the right when even the line and the amount do not.
 * `width` is the grid's own width (null before the first layout).
 */
export function fitColumns(width: number | null, fields: CompleteTableFields): ColumnFit {
  const hidden: TableSlot[] = [];
  if (width == null) return { hidden, pinAmount: false };
  const room = width - SCROLLBAR;
  const needed = () =>
    SPECS.filter((s) => fields[s.slot] && !hidden.some((slot) => slot === s.slot)).reduce(
      (sum, s) => sum + s.minWidth,
      0,
    );
  for (const slot of DROP_ORDER) {
    if (needed() <= room) break;
    if (fields[slot]) hidden.push(slot);
  }
  return { hidden, pinAmount: needed() > room };
}

const slotValue =
  (slot: TableSlot | 'amount') =>
  ({ data }: { data: TableRow | undefined }) =>
    data ? (slot === 'amount' ? data.amount : data.values[slot]) : undefined;

/**
 * AG Grid column definitions for the mapped fields, one column per mapped slot.
 * `showProject: false` (compact rows) leaves the project line out of the client cell.
 */
export function buildColumns(
  fields: CompleteTableFields,
  format: Format,
  fit: ColumnFit = { hidden: [], pinAmount: false },
  { showProject = true }: { showProject?: boolean } = {},
): ColDef<TableRow>[] {
  return SPECS.flatMap((spec) => {
    const field = fields[spec.slot];
    if (!field) return [];
    const params: CellParams & { project?: AgWidgetField } = { slot: spec.slot, field, format };
    if (spec.slot === 'client' && fields.project && showProject) params.project = fields.project;
    const column: ColDef<TableRow> = {
      colId: spec.slot,
      headerName: spec.header,
      valueGetter: slotValue(spec.slot),
      cellRenderer: spec.cellRenderer,
      cellRendererParams: params,
      flex: spec.flex,
      minWidth: spec.minWidth,
      sortable: true,
      resizable: true,
      suppressMovable: true,
      // Always set, so a new width re-applies them to the live grid.
      hide: spec.slot !== 'amount' && fit.hidden.includes(spec.slot),
      pinned: spec.slot === 'amount' && fit.pinAmount ? 'right' : null,
    };
    if (spec.numeric) {
      column.type = 'rightAligned';
      column.comparator = (a: unknown, b: unknown) => Number(a ?? 0) - Number(b ?? 0);
    }
    return [column];
  });
}
