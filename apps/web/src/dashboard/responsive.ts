import {
  type AgResponsiveLayoutBreakpoint,
  type AgResponsiveLayoutCandidate,
  type AgResponsiveLayoutState,
  type AgWidgetLayoutState,
  singleColumnLayout,
} from 'ag-studio';

/**
 * Narrow-screen layouts for view mode (`responsiveLayoutBreakpoints`). Studio
 * hands each breakpoint the desktop layout of every widget and the canvas
 * columns at that width; edit mode always shows the desktop layout.
 */

/** Reading order of the desktop layout: top to bottom, then left to right. */
const readingOrder = (layouts: AgResponsiveLayoutCandidate[]) =>
  layouts
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (a, b) =>
        a.candidate.layout.yTrack - b.candidate.layout.yTrack ||
        a.candidate.layout.xTrack - b.candidate.layout.xTrack,
    );

/**
 * Two columns: widgets wider than half the desktop canvas take the full
 * width, the rest pair up side by side in reading order within their desktop
 * row; one left without a partner takes the full width rather than leave a
 * gap. Heights never drop below the desktop height or the widget's minimum.
 */
export function twoColumnLayout(
  layouts: AgResponsiveLayoutCandidate[],
  { columns }: AgResponsiveLayoutState,
  desktopColumns = 24,
): AgWidgetLayoutState[] {
  const half = Math.floor(columns / 2);
  const result: AgWidgetLayoutState[] = new Array(layouts.length);
  let y = 0;
  let open: { index: number; row: number; height: number } | null = null;

  const closeAlone = () => {
    if (!open) return;
    const placed = result[open.index];
    if (placed) placed.xSpan = columns;
    y += open.height;
    open = null;
  };

  for (const { candidate, index } of readingOrder(layouts)) {
    const { layout, minSize } = candidate;
    const height = Math.max(layout.ySpan, minSize.ySpan);
    const wide = layout.xSpan > desktopColumns / 2 || minSize.xSpan > half;
    if (open && (wide || layout.yTrack !== open.row)) closeAlone();
    if (wide) {
      result[index] = { xTrack: 0, yTrack: y, xSpan: columns, ySpan: height };
      y += height;
    } else if (!open) {
      result[index] = { xTrack: 0, yTrack: y, xSpan: half, ySpan: height };
      open = { index, row: layout.yTrack, height };
    } else {
      result[index] = { xTrack: half, yTrack: y, xSpan: columns - half, ySpan: height };
      y += Math.max(open.height, height);
      open = null;
    }
  }
  closeAlone();
  return result;
}

/** Phones get one column; tablets two; wider canvases keep the authored layout. */
export const DASHBOARD_BREAKPOINTS: AgResponsiveLayoutBreakpoint[] = [
  { maxWidth: 599, layout: singleColumnLayout },
  { minWidth: 600, maxWidth: 999, layout: (layouts, state) => twoColumnLayout(layouts, state) },
];
