import type { QuotesTableStyle } from '../types.js';

/** How the table draws for a given `format.style`. */
export interface TableLayout {
  rowHeight: number;
  headerHeight: number;
  totalRow: boolean;
  /** The project title under the client name; a compact row has no room for it. */
  showProject: boolean;
}

/** Comfortable rows fit the client and the project on two lines; compact rows fit one. */
export function tableLayout(style: QuotesTableStyle | undefined): TableLayout {
  const compact = style?.density === 'compact';
  return {
    rowHeight: compact ? 32 : 44,
    headerHeight: compact ? 32 : 38,
    totalRow: style?.totalRow !== false,
    showProject: !compact,
  };
}
