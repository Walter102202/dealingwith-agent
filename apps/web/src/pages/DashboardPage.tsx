import { DashboardDataSchema, formatUsd } from '@dealingwith/contracts';
import type { AgReportState } from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import { useCallback, useMemo } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useApi } from '../api/hooks.js';
import { routes } from '../api/routes.js';
import { Layout } from '../components/Layout.js';
import { studioLicenseKey } from '../dashboard/license.js';
import { toStudioSources } from '../dashboard/sources.js';
import { DASHBOARD_STATE } from '../dashboard/studio-config.js';
import { dashboardTheme } from '../dashboard/theme.js';
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
  const dashboard = useApi(fetchDashboard);
  const data = dashboard.data;
  const studioData = useMemo(() => (data ? toStudioSources(data) : null), [data]);
  const licenseKey = studioLicenseKey();

  const onStateUpdated = useCallback((event: { state: AgReportState }) => {
    if (import.meta.env.DEV) window.__dwStudioState = event.state;
  }, []);

  const mandate = data?.mandate ?? null;
  const remaining = mandate ? Math.max(0, mandate.totalLimitCents - mandate.spentCents) : null;

  return (
    <Layout width="wide">
      <div className={styles.page}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>Andes Data Studio</h1>
            <p className="muted small">Quotes, additionals and payments across every client.</p>
          </div>
          {remaining !== null ? (
            <p className={styles.budget}>
              Demo mandate budget left <strong>{formatUsd(remaining)}</strong>
            </p>
          ) : null}
        </header>

        {dashboard.error ? (
          <p className="error" role="alert">
            {errorMessage(dashboard.error)}
          </p>
        ) : null}
        {!studioData && !dashboard.error ? <p className="muted">Loading dashboard…</p> : null}

        {studioData ? (
          <div className={styles.studio}>
            <AgStudioProvider {...(licenseKey ? { licenseKey } : {})}>
              <AgStudio
                data={studioData}
                mode="edit"
                theme={dashboardTheme}
                initialState={DASHBOARD_STATE}
                onStateUpdated={onStateUpdated}
              />
            </AgStudioProvider>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
