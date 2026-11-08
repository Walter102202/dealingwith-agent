import type { AgentOutput, ContextPack } from '@dealingwith/contracts';
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
export type AgentPort = {
  buildContextPack(db: Db, input: { clientId: string; projectId?: string }): Promise<ContextPack>;
  runAgent(
    deps: Deps,
    input: {
      pack: ContextPack;
      text: string;
      skill: 'contract-service' | 'analyze-additional' | 'explain-quote';
      requestId: string;
      answers?: Record<string, string>;
    },
  ): Promise<{ output: AgentOutput; runId: string }>;
};
