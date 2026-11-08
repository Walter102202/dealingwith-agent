import { createRequire } from 'node:module';
import type { ClientAgent } from '@dealingwith/contracts';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Deps } from '../workflows/deps.js';
import { formatQuoteMarkdown } from './format.js';
import { assertAgentOwnsQuote } from './scope.js';
import { registerTools } from './tools.js';

const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

/** A fresh MCP server bound to one authenticated agent; built per request (see docs/decisions/2026-11-08-mcp-stateless-per-request.md). */
export function createMcpServer(deps: Deps, agent: ClientAgent): McpServer {
  const server = new McpServer({ name: 'dealingwith-agent', version });
  registerTools(server, deps, agent);
  server.registerResource(
    'quote',
    new ResourceTemplate('quote://{quoteId}', { list: undefined }),
    {
      title: 'Quote',
      description: 'The latest version of a quote as Markdown',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      const raw = variables.quoteId ?? '';
      const quoteId = Array.isArray(raw) ? (raw[0] ?? '') : raw;
      const quote = await assertAgentOwnsQuote(deps.db, quoteId, agent);
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatQuoteMarkdown(quote) }],
      };
    },
  );
  return server;
}
