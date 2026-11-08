import type { Env } from '../../env.js';
import type { PaypalGateway } from './gateway.js';
import { type MockOptions, MockPaypalGateway } from './mock.js';
import { SandboxPaypalGateway } from './sandbox.js';

export * from './gateway.js';
export function createPaypalGateway(
  env: Env,
  options: Pick<MockOptions, 'deliverWebhook'> = {},
): PaypalGateway {
  return env.PAYPAL_MODE === 'mock'
    ? new MockPaypalGateway({
        appUrl: env.APP_URL,
        webhookSecret: env.MOCK_WEBHOOK_SECRET,
        ...options,
      })
    : new SandboxPaypalGateway();
}
