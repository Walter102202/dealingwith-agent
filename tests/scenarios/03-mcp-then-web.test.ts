import { IssuedAgentSchema, PaymentSchema, QuoteSchema } from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { acceptQuote } from '../../apps/backend/src/workflows/accept-quote.js';
import { submitRequest } from '../../apps/backend/src/workflows/submit-request.js';
import { createScenario, post } from './helpers.js';

test('Starts via MCP, continues on web: both channels see the same quote id, version and price', async () => {
  const s = await createScenario();
  try {
    const issued = IssuedAgentSchema.parse(
      await (await s.request('/api/agents', post({ label: "Mara's assistant" }))).json(),
    );
    const quote = await submitRequest(s.deps, {
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'mcp',
      agentId: issued.agent.id,
      text: "Alert me by email when any branch's daily sales drop more than 20%.",
    });
    const web = QuoteSchema.parse(await (await s.request(`/api/quotes/${quote.id}`)).json());
    expect(web).toEqual(quote);
    expect(web.totalCents).toBe(6000);
    const funding = (await (
      await s.request(`/api/mandates/${DEMO.mandate.id}/fund`, post({ fundingAmountCents: 30000 }))
    ).json()) as { orderId: string };
    await s.paypal.approve(funding.orderId);
    expect(
      (
        await s.request(
          `/api/mandates/${DEMO.mandate.id}/fund/complete`,
          post({ orderId: funding.orderId }),
        )
      ).status,
    ).toBe(200);
    const accepted = await acceptQuote(s.deps, {
      quoteId: quote.id,
      version: quote.version,
      actor: { kind: 'agent', agent: issued.agent },
    });
    const payment = PaymentSchema.parse(accepted.payment);
    expect(payment).toMatchObject({
      mode: 'mandate',
      status: 'captured',
      mandateId: DEMO.mandate.id,
    });
    expect(await (await s.request(`/api/payments/${payment.id}`)).json()).toEqual(payment);
  } finally {
    await s.close();
  }
});
