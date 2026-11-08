import { type AppConfig, AppConfigSchema } from '@dealingwith/contracts';
import { api } from './client.js';
import { type ApiState, useApi } from './hooks.js';
import { routes } from './routes.js';

const fetchConfig = () => api.get(routes.config, AppConfigSchema);

/** `GET /api/config`: PayPal mode, client id, app URL and demo mode. Fetched per mounting component. */
export function useAppConfig(): ApiState<AppConfig> {
  return useApi(fetchConfig);
}
