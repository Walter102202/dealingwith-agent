import type {
  AgPanelConfig,
  AgStudioApi,
  AgStudioApiReadyEvent,
  AgStudioMode,
  AgStudioStateUpdatedEvent,
} from 'ag-studio';
import { useCallback, useRef, useState } from 'react';
import { ASSISTANT_PANELS, DASHBOARD_PANELS } from './studio-config.js';

/**
 * What the header shows: the plain report, the report with the assistant
 * beside it, or the full editor.
 */
export type DashboardView = 'report' | 'assistant' | 'edit';

export interface DashboardControls {
  view: DashboardView;
  /** Studio's own mode: its assistant panel exists in edit mode only. */
  mode: AgStudioMode;
  panels: AgPanelConfig;
  pageId: string;
  selectPage: (pageId: string) => void;
  toggleEdit: () => void;
  toggleAssistant: () => void;
  onApiReady: (event: AgStudioApiReadyEvent) => void;
  onStateUpdated: (event: AgStudioStateUpdatedEvent) => void;
}

/**
 * Host-side controls for Studio: report, assistant or edit, and page selection.
 * Studio leaves page navigation to the host, so a page tab writes
 * `selectedPageId` through the API, and every state update (undo included)
 * reports the page back.
 */
export function useDashboardControls(initialPageId: string): DashboardControls {
  const apiRef = useRef<AgStudioApi | null>(null);
  const [view, setView] = useState<DashboardView>('report');
  const [pageId, setPageId] = useState(initialPageId);

  const onApiReady = useCallback((event: AgStudioApiReadyEvent) => {
    apiRef.current = event.api;
  }, []);

  const onStateUpdated = useCallback((event: AgStudioStateUpdatedEvent) => {
    setPageId(event.state.selectedPageId);
  }, []);

  const selectPage = useCallback((next: string) => {
    const api = apiRef.current;
    if (!api) return;
    api.setState({ ...api.getState(), selectedPageId: next });
    setPageId(next);
  }, []);

  const toggleEdit = useCallback(() => setView((v) => (v === 'edit' ? 'report' : 'edit')), []);
  const toggleAssistant = useCallback(
    () => setView((v) => (v === 'assistant' ? 'report' : 'assistant')),
    [],
  );

  return {
    view,
    mode: view === 'report' ? 'view' : 'edit',
    panels: view === 'assistant' ? ASSISTANT_PANELS : DASHBOARD_PANELS,
    pageId,
    selectPage,
    toggleEdit,
    toggleAssistant,
    onApiReady,
    onStateUpdated,
  };
}
