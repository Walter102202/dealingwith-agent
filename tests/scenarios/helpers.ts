import { createApp } from '../../apps/backend/src/api/app.js';
import { createHarness } from '../../apps/backend/src/test/workflow-harness.js';
import { fakeAgentPort } from '../../apps/backend/src/workflows/fake-agent.js';
export const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' } as Record<string, string>,
  body: JSON.stringify(body),
});
export async function createScenario() {
  const harness = await createHarness({ agent: fakeAgentPort() });
  const app = createApp(harness.deps);
  const login = async (role: 'client' | 'provider') => {
    const response = await app.request('/api/session/login', post({ role }));
    const cookie = response.headers.get('set-cookie');
    if (response.status !== 200 || !cookie) throw new Error(`Demo login failed for ${role}`);
    return cookie;
  };
  const cookies = { client: await login('client'), provider: await login('provider') };
  return {
    ...harness,
    app,
    cookies,
    request(
      path: string,
      init: RequestInit = {},
      as: 'client' | 'provider' = 'client',
    ): Promise<Response> {
      const headers = new Headers(init.headers);
      headers.set('cookie', cookies[as]);
      return Promise.resolve(app.request(path, { ...init, headers }));
    },
  };
}
