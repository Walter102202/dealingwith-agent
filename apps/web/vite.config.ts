import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The shared `.env` lives at the repo root; only `VITE_*` keys reach the browser.
const envDir = fileURLToPath(new URL('../..', import.meta.url));
const proxied = ['/api', '/mock-paypal', '/healthz', '/mcp'];

export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, envDir).VITE_API_PROXY || 'http://localhost:3000';
  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: Object.fromEntries(proxied.map((path) => [path, { target, changeOrigin: false }])),
    },
  };
});
