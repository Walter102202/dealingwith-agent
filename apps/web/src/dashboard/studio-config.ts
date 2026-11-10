import type { AgPageLayoutState, AgPanelConfig, AgReportState } from 'ag-studio';
import { AGENT_CHANNEL } from './report/agent-channel.js';
import { COLLECTIONS } from './report/collections.js';
import { OVERVIEW } from './report/overview.js';
import type { DashboardRegistry } from './widgets/types.js';

/**
 * The saved dashboard definition (spec 7.7), three pages hand-written from the
 * state shape learned in the editor (decision 2026-11-07-ag-studio-definition-loading).
 * Each page lives in `./report/`; Studio has no page names, so the header
 * draws the page tabs from `DASHBOARD_PAGES`.
 */

export const DASHBOARD_PAGES = [
  { id: OVERVIEW.id, title: 'Overview' },
  { id: COLLECTIONS.id, title: 'Collections' },
  { id: AGENT_CHANNEL.id, title: 'Agent channel' },
] as const;

export const DASHBOARD_STATE: AgReportState<DashboardRegistry> = {
  version: '3.1.0',
  selectedPageId: OVERVIEW.id,
  pages: [OVERVIEW, COLLECTIONS, AGENT_CHANNEL],
};

/**
 * Read mode is a clean report: no panels. Edit mode keeps Studio's default
 * placement (assistant on the left; filters, compose and data on the right).
 */
export const DASHBOARD_PANELS: AgPanelConfig = {
  view: { left: [], right: [] },
  edit: { left: ['ai'], right: ['filters', 'edit', 'data'] },
};

/** Lets the canvas shrink to a phone; `responsive.ts` re-flows the widgets below 1000 px. */
export const DASHBOARD_LAYOUT: Partial<AgPageLayoutState> = { minWidth: 300 };
