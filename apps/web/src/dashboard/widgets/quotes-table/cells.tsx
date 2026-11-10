import type { CustomCellRendererProps } from 'ag-grid-react';
import type { AgWidgetField } from 'ag-studio';
import { Badge, isStatus, StatusBadge } from '../../../components/Badge.js';
import { formatValue } from '../money.js';
import styles from './QuotesTable.module.css';
import type { TableRow, TableSlot } from './rows.js';

/** What every cell renderer gets besides AG Grid's own props (`cellRendererParams`). */
export interface CellParams {
  slot: TableSlot | 'amount';
  field: AgWidgetField;
  format: (field: AgWidgetField, value: unknown) => string;
}

type CellProps = CustomCellRendererProps<TableRow> & CellParams;

const isTotal = (props: CellProps) => props.node.rowPinned === 'bottom';
const pressed = (props: CellProps) =>
  props.slot !== 'amount' && (props.data?.selected.includes(props.slot) ?? false);

/** Client name with the project title under it when one is mapped. */
export function ClientCell(props: CellProps & { project?: AgWidgetField }) {
  if (isTotal(props) || !props.data) return null;
  const project = props.data.values.project;
  return (
    <span className={styles.client}>
      <span className={styles.clientName}>{props.format(props.field, props.value)}</span>
      {props.project && project != null ? (
        <span className={styles.project}>{props.format(props.project, project)}</span>
      ) : null}
    </span>
  );
}

export function TextCell(props: CellProps) {
  if (isTotal(props)) return props.slot === 'line' ? <strong>Total</strong> : null;
  return <span className={styles.text}>{props.format(props.field, props.value)}</span>;
}

export function RuleCell(props: CellProps) {
  if (isTotal(props) || props.value == null) return null;
  return <code className={styles.rule}>{props.format(props.field, props.value)}</code>;
}

/** Quote status as the product's status pill; a click on it cross-filters on that status. */
export function StatusCell(props: CellProps) {
  if (isTotal(props) || props.value == null) return null;
  const pill = isStatus(props.value) ? (
    <StatusBadge status={props.value} />
  ) : (
    <Badge tone="neutral">{props.format(props.field, props.value)}</Badge>
  );
  return <span className={pressed(props) ? styles.pressed : styles.pill}>{pill}</span>;
}

/** "web" or "agent" (the MCP channel, named by the field's formatter), the agent in amber. */
export function ChannelCell(props: CellProps) {
  if (isTotal(props) || props.value == null) return null;
  return (
    <span className={pressed(props) ? styles.pressed : styles.pill}>
      <Badge tone={props.value === 'mcp' ? 'warning' : 'neutral'}>
        {props.format(props.field, props.value)}
      </Badge>
    </span>
  );
}

/** The line amount: integer cents formatted with `formatUsd` at render. */
export function AmountCell(props: CellProps) {
  const text = formatValue(props.field, props.value, props.format);
  return isTotal(props) ? <strong>{text}</strong> : <span>{text}</span>;
}
