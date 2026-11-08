import { type AppConfig, AppConfigSchema } from '@dealingwith/contracts';
import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { api } from './client.js';
import { type ApiState, useApi } from './hooks.js';
import { routes } from './routes.js';

const fetchConfig = () => api.get(routes.config, AppConfigSchema);
const AppConfigContext = createContext<ApiState<AppConfig> | null>(null);

/** One configuration request shared by all consumers beneath this provider. */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const config = useApi(fetchConfig);
  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}

/**
 * The shared configuration. A consumer that mounts while the one request has
 * failed asks for it again, once: a transient failure at load no longer hides
 * the demo reset and the payment options until a full reload.
 */
export function useAppConfig(): ApiState<AppConfig> {
  const config = useContext(AppConfigContext);
  if (!config) throw new Error('useAppConfig must be used inside AppConfigProvider');
  const retried = useRef(false);
  const { error, loading, refetch } = config;
  useEffect(() => {
    if (error && !loading && !retried.current) {
      retried.current = true;
      void refetch();
    }
  }, [error, loading, refetch]);
  return config;
}
