import { agentsHandlers } from './handlers/agents.js';
import { catalogHandlers } from './handlers/catalog.js';
import { dashboardHandlers } from './handlers/dashboard.js';
import { mandatesHandlers } from './handlers/mandates.js';
import { paymentsHandlers } from './handlers/payments.js';
import { quotesHandlers } from './handlers/quotes.js';
import { sessionHandlers } from './handlers/session.js';

/** Fixtures API assembled by domain; dispatch keeps the same interface. */
export const handlers = {
  ...sessionHandlers,
  ...catalogHandlers,
  ...quotesHandlers,
  ...paymentsHandlers,
  ...mandatesHandlers,
  ...agentsHandlers,
  ...dashboardHandlers,
};
