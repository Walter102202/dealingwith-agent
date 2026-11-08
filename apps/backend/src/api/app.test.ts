import { randomUUID } from 'node:crypto';
import {
  AcceptQuoteResultSchema,
  ProjectSchema,
  ProjectViewSchema,
  QuoteSchema,
} from '@dealingwith/contracts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { signSession } from '../access/session.js';
import { DEMO } from '../db/demo-data.js';
import { businesses, clients, projects, services } from '../db/schema.js';
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
  test('lists only the client projects or the provider business projects and requires a session', async () => {
    const secondClientId = randomUUID();
    const secondProjectId = randomUUID();
    const foreignBusinessId = randomUUID();
    const foreignClientId = randomUUID();
    const foreignServiceId = randomUUID();
    const foreignProjectId = randomUUID();
    await h.deps.db
      .insert(businesses)
      .values({ id: foreignBusinessId, name: 'Other business', country: 'US' });
    await h.deps.db.insert(clients).values([
      {
        id: secondClientId,
        businessId: DEMO.business.id,
        name: 'Second client',
        email: 'second@example.test',
      },
      {
        id: foreignClientId,
        businessId: foreignBusinessId,
        name: 'Other client',
        email: 'other@example.test',
      },
    ]);
    await h.deps.db
      .insert(services)
      .values({ id: foreignServiceId, businessId: foreignBusinessId, name: 'Other service' });
    await h.deps.db.insert(projects).values([
      {
        id: secondProjectId,
        businessId: DEMO.business.id,
        clientId: secondClientId,
        serviceId: DEMO.services.S1.id,
        title: 'Second project',
      },
      {
        id: foreignProjectId,
        businessId: foreignBusinessId,
        clientId: foreignClientId,
        serviceId: foreignServiceId,
        title: 'Other business project',
      },
    ]);
    const anonymous = await app.request('/api/projects');
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ error: { code: 'unauthenticated' } });
    const list = async (sessionCookie: string) => {
      const response = await app.request('/api/projects', { headers: { cookie: sessionCookie } });
      expect(response.status).toBe(200);
      return ProjectSchema.array()
        .parse(await response.json())
        .map((p) => p.id)
        .sort();
    };
    expect(await list(cookie)).toEqual([DEMO.project.id]);
    expect(await list(provider)).toEqual([DEMO.project.id, secondProjectId].sort());
    const emptyCookie = `dw_session=${signSession({ role: 'client', clientId: randomUUID(), businessId: DEMO.business.id, name: 'No projects' }, h.deps.env.SESSION_SECRET, { now: h.deps.now() })}`;
    expect(await list(emptyCookie)).toEqual([]);
  });
});
