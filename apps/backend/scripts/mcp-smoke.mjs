#!/usr/bin/env node
// Smoke check of the MCP endpoint with the official SDK client: lists the tools
// and calls list_services. Usage:
//   MCP_URL=http://localhost:3002/mcp MCP_TOKEN=dwa_... pnpm --filter @dealingwith/backend mcp:smoke
// The token is sent as a bearer header and never printed.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.env.MCP_URL;
const token = process.env.MCP_TOKEN;
if (!url || !token) {
  console.error('Set MCP_URL (e.g. http://localhost:3002/mcp) and MCP_TOKEN (dwa_...).');
  process.exit(2);
}
const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
const client = new Client({ name: 'dealingwith-mcp-smoke', version: '0.1.0' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`Tools (${tools.length}): ${tools.map((t) => t.name).join(', ')}`);
  const result = await client.callTool({ name: 'list_services', arguments: {} });
  if (result.isError) throw new Error(result.content?.[0]?.text ?? 'list_services failed');
  const services = result.structuredContent?.services ?? [];
  console.log(`Services (${services.length}): ${services.map((s) => s.name).join(', ')}`);
} finally {
  await client.close();
}
