/**
 * Every API path the web calls, mirroring Task A7's route table path by path.
 * Nothing else in the app spells an `/api` string.
 */
export const routes = {
  healthz: '/healthz',
  config: '/api/config',
  session: {
    login: '/api/session/login',
    logout: '/api/session/logout',
    me: '/api/me',
  },
  services: '/api/services',
  projects: {
    list: '/api/projects',
    get: (id: string) => `/api/projects/${id}`,
    requests: (id: string) => `/api/projects/${id}/requests`,
  },
  requests: {
    create: '/api/requests',
  },
  quotes: {
    get: (id: string, version?: number) =>
      version === undefined ? `/api/quotes/${id}` : `/api/quotes/${id}?version=${version}`,
    versions: (id: string) => `/api/quotes/${id}/versions`,
    answers: (id: string) => `/api/quotes/${id}/answers`,
    accept: (id: string) => `/api/quotes/${id}/accept`,
  },
  paypal: {
    capture: (orderId: string) => `/api/paypal/orders/${encodeURIComponent(orderId)}/capture`,
  },
  payments: {
    get: (id: string) => `/api/payments/${id}`,
  },
  mandates: {
    create: '/api/mandates',
    update: (id: string) => `/api/mandates/${id}`,
    fund: (id: string) => `/api/mandates/${id}/fund`,
    fundComplete: (id: string) => `/api/mandates/${id}/fund/complete`,
    revoke: (id: string) => `/api/mandates/${id}/revoke`,
  },
  agents: {
    list: '/api/agents',
    create: '/api/agents',
    revoke: (id: string) => `/api/agents/${id}`,
  },
  events: (projectId?: string) =>
    projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events',
  dashboard: {
    data: '/api/dashboard/data',
    assistantTurn: '/api/dashboard/assistant/turn',
  },
  demo: {
    reset: '/api/demo/reset',
  },
} as const;
