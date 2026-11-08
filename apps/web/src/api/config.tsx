import { type AppConfig, AppConfigSchema } from '@dealingwith/contracts';
import { createContext, type ReactNode, useContext } from 'react';
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

export function useAppConfig(): ApiState<AppConfig> {
  const config = useContext(AppConfigContext);
  if (!config) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return config;
}
