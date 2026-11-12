import {
  AGENT_TOKEN_PATTERN,
  AppConfigSchema,
  DashboardDataSchema,
  IssuedAgentSchema,
  MandateSchema,
  ProjectViewSchema,
  QuoteSchema,
  SessionSchema,
} from '@dealingwith/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_IDS } from './demo-ids.js';
import { handlers } from './handlers.js';
import { DEMO_QUOTES } from './quotes.js';
import { resetState } from './state.js';

describe('fixtures', () => {
  beforeEach(() => {
    resetState();
  });

  it('every fixture quote parses with QuoteSchema', () => {
    for (const quote of Object.values(DEMO_QUOTES)) {
      expect(() => QuoteSchema.parse(quote)).not.toThrow();
    }
    expect(Object.keys(DEMO_QUOTES)).toHaveLength(6);
  });

  it('the initial project view parses with ProjectViewSchema', async () => {
    const view = await handlers.getProject(DEMO_IDS.project);
    expect(() => ProjectViewSchema.parse(view)).not.toThrow();
    expect(view.project.scopeClauses).toHaveLength(3);
    expect(view.mandate?.status).toBe('pending');
  });

  it('config, sessions, mandate, issued agent and dashboard data parse', async () => {
    expect(() => AppConfigSchema.parse(handlers.config())).not.toThrow();
    expect(() => SessionSchema.parse(handlers.login('client'))).not.toThrow();
    expect(() => SessionSchema.parse(handlers.login('provider'))).not.toThrow();
    const mandate = await handlers.getProject(DEMO_IDS.project).then((v) => v.mandate);
    expect(() => MandateSchema.parse(mandate)).not.toThrow();
    const issued = await handlers.issueAgent({ label: "Mara's assistant" });
    expect(() => IssuedAgentSchema.parse(issued)).not.toThrow();
    expect(issued.token).toMatch(AGENT_TOKEN_PATTERN);
    expect(() => DashboardDataSchema.parse(handlers.dashboardData())).not.toThrow();
  });

  it('accept plus capture of request 1 appends clause C4 sourced from the quote', async () => {
    const quote = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    expect(quote.totalCents).toBe(8000);
    const accepted = await handlers.acceptQuote(quote.id, { version: quote.version });
    expect(accepted.status).toBe('approval_required');
    expect(accepted.approvalUrl).toContain('/pay/return?token=');
    const orderId = accepted.payment?.paypalOrderId;
    expect(orderId).toBeDefined();
    const payment = await handlers.captureOrder(orderId as string);
    expect(payment.status).toBe('captured');
    const view = await handlers.getProject(DEMO_IDS.project);
    expect(view.project.scopeClauses).toHaveLength(4);
    expect(view.project.scopeClauses[3]?.source.kind).toBe('quote');
    expect(view.quotes[0]?.status).toBe('paid');
  });

  it('request 4 after paying request 1 renders as included at US$0', async () => {
    const first = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    const accepted = await handlers.acceptQuote(first.id, { version: 1 });
    await handlers.captureOrder(accepted.payment?.paypalOrderId as string);
    const fourth = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'Send the Monday summary to our regional managers too.',
    });
    expect(fourth.totalCents).toBe(0);
    expect(fourth.lineItems[0]?.kind).toBe('included');
  });

  it('accepting a zero-total quote answers paid without a payment, like the backend', async () => {
    const first = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    const accepted = await handlers.acceptQuote(first.id, { version: 1 });
    await handlers.captureOrder(accepted.payment?.paypalOrderId as string);
    const fourth = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'Send the Monday summary to our regional managers too.',
    });
    const paymentsBefore = (await handlers.getProject(DEMO_IDS.project)).payments.length;
    const result = await handlers.acceptQuote(fourth.id, { version: 1 });
    expect(result.status).toBe('paid');
    expect(result.payment).toBeUndefined();
    expect(result.message).toMatch(/Nothing to pay/);
    const view = await handlers.getProject(DEMO_IDS.project);
    expect(view.payments).toHaveLength(paymentsBefore);
    expect(view.quotes.find((q) => q.id === fourth.id)?.status).toBe('paid');
  });

  it('reset restores the initial state', async () => {
    const first = await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'summary email every Monday',
    });
    const accepted = await handlers.acceptQuote(first.id, { version: 1 });
    await handlers.captureOrder(accepted.payment?.paypalOrderId as string);
    handlers.resetDemo();
    const view = await handlers.getProject(DEMO_IDS.project);
    expect(view.project.scopeClauses).toHaveLength(3);
    expect(view.quotes).toHaveLength(0);
  });

  it('reset leaves the agent budget unassigned, like the backend', async () => {
    const order = handlers.fundMandate(DEMO_IDS.mandate, { fundingAmountCents: 30000 });
    const funded = handlers.completeFunding(DEMO_IDS.mandate, { orderId: order.orderId });
    expect(funded).toMatchObject({ status: 'active', funding: { fundingAmountCents: 30000 } });
    handlers.resetDemo();
    const view = await handlers.getProject(DEMO_IDS.project);
    expect(view.mandate).toMatchObject({
      status: 'pending',
      spentCents: 0,
      funding: { fundingAmountCents: 0, fundingCapturedCents: 0 },
    });
    expect(view.mandate?.funding.paypalAuthorizationId).toBeUndefined();
  });
});
