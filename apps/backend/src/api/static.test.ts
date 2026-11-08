import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import { mountStatic } from './static.js';

describe('mountStatic', () => {
  test('serves assets and the SPA fallback while excluding reserved routes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dealingwith-static-'));
    try {
      await writeFile(join(dir, 'index.html'), '<h1>Demo app</h1>');
      await writeFile(join(dir, 'asset.js'), 'export const ready = true;');
      const app = new Hono();
      mountStatic(app, dir);
      expect(await (await app.request('/asset.js')).text()).toContain('ready');
      const fallback = await app.request('/portal/projects/example');
      expect(fallback.status).toBe(200);
      expect(await fallback.text()).toContain('Demo app');
      for (const path of ['/api/missing', '/mcp/missing', '/mock-paypal/missing', '/healthz'])
        expect((await app.request(path)).status).toBe(404);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
