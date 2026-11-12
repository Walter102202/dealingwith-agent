import { DashboardDataSchema } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { issueAgentToken } from '../../access/agent-tokens.js';
import { DEMO } from '../../db/demo-data.js';
import { activateMandate, createHarness, publishedQuote } from '../../test/workflow-harness.js';
import { acceptQuote } from '../../workflows/accept-quote.js';
import { captureApprovedOrder } from '../../workflows/capture.js';
import { fakeAgentPort } from '../../workflows/fake-agent.js';
import { submitRequest } from '../../workflows/submit-request.js';
import { buildDashboardData } from './dashboard.js';

describe('buildDashboardData', () => {
  test('maps paid quote lines to their service and capture rows', async () => {
    const h = await createHarness({ agent: fakeAgentPort() });
    try {
      const q = await submitRequest(h.deps, {
        clientId: DEMO.client.id,
        projectId: DEMO.project.id,
        channel: 'web',
        text: 'summary email every Monday',
      });
      const accepted = await acceptQuote(h.deps, {
        quoteId: q.id,
        version: 1,
        actor: { kind: 'web', clientId: DEMO.client.id },
      });
      const orderId = accepted.payment?.paypalOrderId ?? '';
      await h.paypal.approve(orderId);
      await captureApprovedOrder(h.deps, { orderId });
      const data = DashboardDataSchema.parse(
        await buildDashboardData(h.deps.db, DEMO.business.id, h.deps.now()),
      );
      expect(data.quotes).toMatchObject([{ status: 'paid' }]);
      expect(data.lines).toContainEqual(
        expect.objectContaining({
          serviceName: 'Automations',
          ruleId: 'S2.report',
          amountCents: 8000,
        }),
      );
      expect(data.payments).toMatchObject([{ status: 'captured', agentName: null }]);
    } finally {
      await h.close();
    }
  });
  test('names the agent behind a payment made within the mandate', async () => {
    const h = await createHarness();
    try {
      await activateMandate(h.deps);
      const q = await publishedQuote(h.deps, {
        intents: [
          {
            kind: 'rule',
            ref: { id: 'S2.alert', version: 1 },
            quantity: 1,
            label: 'a',
            rationale: 'a',
          },
        ],
      });
      const { agent } = await issueAgentToken(h.deps.db, {
        clientId: DEMO.client.id,
        label: "Mara's assistant",
      });
      await acceptQuote(h.deps, { quoteId: q.id, version: 1, actor: { kind: 'agent', agent } });
      const data = await buildDashboardData(h.deps.db, DEMO.business.id, h.deps.now());
      expect(data.payments).toMatchObject([
        { mode: 'mandate', status: 'captured', agentName: "Mara's assistant" },
      ]);
    } finally {
      await h.close();
    }
  });
});
