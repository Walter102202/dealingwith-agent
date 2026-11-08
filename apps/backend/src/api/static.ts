import { existsSync } from 'node:fs';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Env, Hono } from 'hono';
export function mountStatic<E extends Env>(app: Hono<E>, dir: string): void {
  const files = existsSync(dir) ? serveStatic<E>({ root: dir }) : null;
  const fallback = serveStatic<E>({ path: `${dir}/index.html` });
  app.get('*', async (c, next) => {
    if (/^\/(api|mcp|mock-paypal|healthz)(\/|$)/.test(c.req.path) || !files)
      return c.json({ error: { code: 'not_found', message: 'Page not found' } }, 404);
    return files(c, async () => {
      const response = await fallback(c, next);
      if (response) c.res = response;
    });
  });
}
