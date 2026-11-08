import type { AgentPort } from '../agent/port.js';
import type { Db } from '../db/client.js';
import type { Env } from '../env.js';
import type { PaypalGateway } from '../integrations/paypal/gateway.js';
import type { Logger } from '../observability/logger.js';
import type { EventBus } from './events.js';
export type Deps = {
  db: Db;
  paypal: PaypalGateway;
  events: EventBus;
  env: Env;
  now: () => Date;
  logger: Logger;
  agent: AgentPort;
};
/** The real port lives in `src/agent/port.ts`; the fake one in `./fake-agent.ts`. */
export type { AgentPort };
