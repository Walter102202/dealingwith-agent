import type {
  AgStudioApi,
  AgStudioApiReadyEvent,
  AgStudioMode,
  AgStudioStateUpdatedEvent,
} from 'ag-studio';
import { useCallback, useRef, useState } from 'react';

export interface DashboardControls {
  mode: AgStudioMode;
  pageId: string;
  selectPage: (pageId: string) => void;
  toggleMode: () => void;
  onApiReady: (event: AgStudioApiReadyEvent) => void;
  onStateUpdated: (event: AgStudioStateUpdatedEvent) => void;
}

/**
 * Host-side controls for Studio: read or edit mode, and page selection.
 * Studio leaves page navigation to the host, so a page tab writes
 * `selectedPageId` through the API, and every state update (undo included)
 * reports the page back.
 */
export function useDashboardControls(initialPageId: string): DashboardControls {
  const apiRef = useRef<AgStudioApi | null>(null);
  const [mode, setMode] = useState<AgStudioMode>('view');
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

  const toggleMode = useCallback(() => setMode((m) => (m === 'view' ? 'edit' : 'view')), []);

  return { mode, pageId, selectPage, toggleMode, onApiReady, onStateUpdated };
}
