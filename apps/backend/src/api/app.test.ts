import { AcceptQuoteResultSchema, ProjectViewSchema, QuoteSchema } from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import { createHarness } from '../test/workflow-harness.js';
import { makeEvent } from '../workflows/events.js';
import { fakeAgentPort } from '../workflows/fake-agent.js';
import { createApp } from './app.js';

let h: Awaited<ReturnType<typeof createHarness>>;
let app: ReturnType<typeof createApp>;
let cookie: string;
let provider: string;
const json = (body: unknown, cookie?: string) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});
beforeAll(async () => {
  h = await createHarness({ agent: fakeAgentPort() });
  app = createApp(h.deps);
});
afterAll(async () => {
  await h.close();
});
describe('createApp', () => {
  test('returns a validation error for malformed JSON instead of an internal error', async () => {
    const response = await app.request('/api/session/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'validation_error' } });
  });
  test('serves health, configuration and signed demo sessions', async () => {
    expect((await app.request('/healthz')).status).toBe(200);
    expect(await (await app.request('/api/config')).json()).toMatchObject({ paypalMode: 'mock' });
    const login = await app.request('/api/session/login', json({ role: 'client' }));
    cookie = login.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('dw_session=');
    expect(cookie).toContain('HttpOnly');
    const p = await app.request('/api/session/login', json({ role: 'provider' }));
    provider = p.headers.get('set-cookie') ?? '';
  });
  test('guards projects, validates requests, accepts and captures the exact quote', async () => {
    const path = `/api/projects/${DEMO.project.id}`;
    expect((await app.request(path)).status).toBe(401);
    const project = ProjectViewSchema.parse(
      await (await app.request(path, { headers: { cookie } })).json(),
    );
    expect(project.project.scopeClauses).toHaveLength(3);
    expect(project.mandate?.status).toBe('pending');
    const invalid = await app.request(`${path}/requests`, json({ text: '' }, cookie));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'validation_error' } });
    const response = await app.request(
      `${path}/requests`,
      json({ text: 'I need a per-branch view and a summary email every Monday.' }, cookie),
    );
    expect(response.status).toBe(200);
    const q = QuoteSchema.parse(await response.json());
    expect(q.totalCents).toBe(8000);
    const accepted = AcceptQuoteResultSchema.parse(
      await (await app.request(`/api/quotes/${q.id}/accept`, json({ version: 1 }, cookie))).json(),
    );
    expect(accepted.status).toBe('approval_required');
    const orderId = accepted.payment?.paypalOrderId ?? '';
    expect((await app.request(`/mock-paypal/approve/${orderId}`)).status).toBe(200);
    await h.paypal.approve(orderId);
    expect(
      await (await app.request(`/api/paypal/orders/${orderId}/capture`, json({}, cookie))).json(),
    ).toMatchObject({ status: 'captured' });
    const after = ProjectViewSchema.parse(
      await (await app.request(path, { headers: { cookie } })).json(),
    );
    expect(after.project.scopeClauses).toHaveLength(4);
    expect(after.quotes[0]?.status).toBe('paid');
  });
  test('issues tokens once, guards provider routes, and rejects bad webhook signatures', async () => {
    const issued = await app.request('/api/agents', json({ label: 'Assistant' }, cookie));
    expect(issued.status).toBe(201);
    expect(await issued.json()).toMatchObject({
      token: expect.stringMatching(/^dwa_/),
      snippets: { cursor: expect.any(String) },
    });
    const list = await (await app.request('/api/agents', { headers: { cookie } })).json();
    expect(JSON.stringify(list)).not.toContain('dwa_');
    expect((await app.request('/api/webhooks/paypal', json({}))).status).toBe(400);
    expect((await app.request('/api/dashboard/data', { headers: { cookie } })).status).toBe(403);
    expect(
      (await app.request('/api/dashboard/data', { headers: { cookie: provider } })).status,
    ).toBe(200);
  });
  test('streams project events and releases the subscription on abort', async () => {
    const controller = new AbortController();
    const response = await app.request(`/api/events?projectId=${DEMO.project.id}`, {
      headers: { cookie },
      signal: controller.signal,
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    const project = ProjectViewSchema.parse(
      await (await app.request(`/api/projects/${DEMO.project.id}`, { headers: { cookie } })).json(),
    );
    const q = project.quotes[0];
    if (!q) throw new Error('Missing quote');
    h.deps.events.publish(
      makeEvent(h.deps, { type: 'quote.paid', projectId: DEMO.project.id, quote: q }),
    );
    const chunk = await reader?.read();
    expect(new TextDecoder().decode(chunk?.value)).toContain('quote.paid');
    controller.abort();
    await reader?.cancel();
  });
  test('resets demo data and returns JSON for missing API routes', async () => {
    expect((await app.request('/api/demo/reset', json({}, provider))).status).toBe(200);
    const data = ProjectViewSchema.parse(
      await (await app.request(`/api/projects/${DEMO.project.id}`, { headers: { cookie } })).json(),
    );
    expect(data.project.scopeClauses).toHaveLength(3);
    expect((await app.request('/api/missing')).status).toBe(404);
  });
});
