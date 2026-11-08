import type { Env } from '../../env.js';
import { createLogger, type Logger } from '../../observability/logger.js';
import type { PaypalGateway } from './gateway.js';
import { type MockOptions, MockPaypalGateway } from './mock.js';
import { SandboxPaypalGateway } from './sandbox.js';

export * from './gateway.js';
export function createPaypalGateway(
  env: Env,
  options: Pick<MockOptions, 'deliverWebhook'> & { logger?: Pick<Logger, 'warn'> } = {},
): PaypalGateway {
  if (env.PAYPAL_MODE === 'sandbox' && !env.PAYPAL_WEBHOOK_ID?.trim())
    (options.logger ?? createLogger()).warn('paypal.webhook_id_missing');
  return env.PAYPAL_MODE === 'mock'
    ? new MockPaypalGateway({
        appUrl: env.APP_URL,
        webhookSecret: env.MOCK_WEBHOOK_SECRET,
        ...options,
      })
    : new SandboxPaypalGateway(env.PAYPAL_WEBHOOK_ID);
}
