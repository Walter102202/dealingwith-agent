import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const target = process.env.VITE_API_PROXY ?? 'http://localhost:3000';
const proxied = ['/api', '/mock-paypal', '/healthz', '/mcp'];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(proxied.map((path) => [path, { target, changeOrigin: false }])),
  },
});
