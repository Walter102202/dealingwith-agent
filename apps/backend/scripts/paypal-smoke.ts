import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { createTokenSource, SANDBOX_URL } from '../src/integrations/paypal/auth.js';
import { PaypalError } from '../src/integrations/paypal/gateway.js';
import { SandboxPaypalGateway } from '../src/integrations/paypal/sandbox.js';

const envFile = ['.env', '../.env', '../../.env'].map((path) => resolve(path)).find(existsSync);
if (envFile) process.loadEnvFile(envFile);

async function main(): Promise<void> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new PaypalError('PAYPAL_CREDENTIALS_MISSING', 500);
  const options = { clientId, clientSecret };
  const gateway = new SandboxPaypalGateway(options);
  const runId = randomUUID();
  const appUrl = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3004';
  const common = { returnUrl: `${appUrl}/login`, cancelUrl: `${appUrl}/login` };
  console.log(`Smoke run ${new Date().toISOString()} (sandbox only)`);
  const capture = await gateway.createOrder({
    ...common,
    intent: 'CAPTURE',
    amountCents: 100,
    customId: `smoke:capture:${runId}`,
    requestId: `smoke-create-capture:${runId}`,
  });
  console.log(`CAPTURE USD 1.00 approve: ${capture.approveUrl}`);
  const authorize = await gateway.createOrder({
    ...common,
    intent: 'AUTHORIZE',
    amountCents: 2000,
    customId: `smoke:authorize:${runId}`,
    requestId: `smoke-create-authorize:${runId}`,
  });
  console.log(`AUTHORIZE USD 20.00 approve: ${authorize.approveUrl}`);
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await terminal.question(
      'Open both links with the PERSONAL sandbox account and approve. Press Enter only after both approvals: ',
    );
  } finally {
    terminal.close();
  }
  const paid = await gateway.captureOrder(capture.orderId, `smoke-capture:${runId}`);
  console.log(`Capture id=${paid.captureId} status=${paid.status}`);
  if (paid.status !== 'COMPLETED' || paid.amountCents !== 100)
    throw new PaypalError('SMOKE_CAPTURE_NOT_COMPLETED', 502);
  const funding = await gateway.authorizeOrder(authorize.orderId, `smoke-authorize:${runId}`);
  console.log(
    `Authorization id=${funding.authorizationId} expiration_time=${funding.expiresAt ?? 'null'}`,
  );
  if (funding.amountCents !== 2000)
    throw new PaypalError('SMOKE_AUTHORIZATION_AMOUNT_MISMATCH', 502);
  const partial = await gateway.captureAuthorization(funding.authorizationId, {
    amountCents: 100,
    finalCapture: false,
    requestId: `smoke-partial:${runId}`,
    invoiceId: `smoke:${runId}`,
  });
  console.log(`Partial capture id=${partial.captureId} status=${partial.status}`);
  if (partial.status !== 'COMPLETED' || partial.amountCents !== 100)
    throw new PaypalError('SMOKE_PARTIAL_NOT_COMPLETED', 502);
  const token = await createTokenSource(options).getAccessToken();
  const vault = await fetch(`${SANDBOX_URL}/v3/vault/setup-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `smoke-vault:${runId}`,
    },
    body: JSON.stringify({ payment_source: { paypal: { usage_type: 'MERCHANT' } } }),
  });
  if (vault.ok)
    console.log('Vault probe: setup token creation is enabled (token not printed or used).');
  else {
    const error = z
      .object({
        name: z.string().optional(),
        details: z.array(z.object({ issue: z.string().optional() })).optional(),
      })
      .safeParse(await vault.json());
    console.log(
      `Vault probe: name=${error.success ? (error.data.name ?? 'unknown') : 'unknown'} issue=${error.success ? (error.data.details?.[0]?.issue ?? 'unknown') : 'unknown'}`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(`Smoke failed: ${error instanceof PaypalError ? error.code : 'UNEXPECTED_ERROR'}`);
  process.exitCode = 1;
}
