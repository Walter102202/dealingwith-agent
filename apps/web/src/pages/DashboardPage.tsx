import { DashboardDataSchema } from '@dealingwith/contracts';
import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import { useCallback, useMemo } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useApi } from '../api/hooks.js';
import { routes } from '../api/routes.js';
import { Layout } from '../components/Layout.js';
import { useDashboardAssistant } from '../dashboard/assistant/useDashboardAssistant.js';
import { DashboardToolbar } from '../dashboard/DashboardToolbar.js';
import { studioLicenseKey } from '../dashboard/license.js';
import { DASHBOARD_BREAKPOINTS } from '../dashboard/responsive.js';
import { toStudioSources } from '../dashboard/sources.js';
import { DASHBOARD_LAYOUT, DASHBOARD_PAGES, DASHBOARD_STATE } from '../dashboard/studio-config.js';
import { dashboardTheme } from '../dashboard/theme.js';
import { useDashboardControls } from '../dashboard/use-dashboard-controls.js';
import { type DashboardRegistry, dashboardWidgets } from '../dashboard/widgets/index.js';
import { useSession } from '../session.js';
import styles from './DashboardPage.module.css';

const fetchDashboard = () => api.get(routes.dashboard.data, DashboardDataSchema);

declare global {
  interface Window {
    /** Dev only: the latest Studio state, so a dashboard built in the editor can be copied into studio-config.ts. */
    __dwStudioState?: AgReportState;
  }
}

/** `/dashboard`: the provider's AG Studio dashboard over quotes, lines, payments and requests. */
export default function DashboardPage() {
  const { session } = useSession();
  const dashboard = useApi(fetchDashboard);
  const data = dashboard.data;
  const studioData = useMemo(() => (data ? toStudioSources(data) : null), [data]);
  const licenseKey = studioLicenseKey();
  const assistant = useDashboardAssistant(data);
  const controls = useDashboardControls(DASHBOARD_STATE.selectedPageId);
  const { onStateUpdated: reportPage } = controls;

  const onStateUpdated = useCallback(
    (event: Parameters<typeof reportPage>[0]) => {
      reportPage(event);
      if (import.meta.env.DEV) window.__dwStudioState = event.state;
    },
    [reportPage],
  );

  return (
    <Layout width="wide">
      <div className={styles.page}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>
              {session?.role === 'provider' ? session.name : 'Dashboard'}
            </h1>
            <p className="muted small">Quotes, additionals and payments across every client.</p>
          </div>
          {studioData && assistant ? (
            <DashboardToolbar
              pages={DASHBOARD_PAGES}
              pageId={controls.pageId}
              onSelectPage={controls.selectPage}
              editing={controls.view === 'edit'}
              onToggleEdit={controls.toggleEdit}
              {...(assistant.ai
                ? {
                    assistant: {
                      open: controls.view === 'assistant',
                      onToggle: controls.toggleAssistant,
                    },
                  }
                : {})}
            />
          ) : null}
        </header>

        {dashboard.error ? (
          <p className="error" role="alert">
            {errorMessage(dashboard.error)}
          </p>
        ) : null}
        {!studioData && !dashboard.error ? <p className="muted">Loading dashboard…</p> : null}

        {studioData && assistant ? (
          <div className={styles.studio}>
            <AgStudioProvider {...(licenseKey ? { licenseKey } : {})}>
              <AgStudio<DashboardRegistry>
                data={studioData}
                mode={controls.mode}
                theme={dashboardTheme}
                initialState={DASHBOARD_STATE}
                onStateUpdated={onStateUpdated}
                onApiReady={controls.onApiReady}
                widgets={dashboardWidgets}
                panels={controls.panels}
                layout={DASHBOARD_LAYOUT}
                responsiveLayoutBreakpoints={DASHBOARD_BREAKPOINTS}
                {...assistant}
              />
            </AgStudioProvider>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
