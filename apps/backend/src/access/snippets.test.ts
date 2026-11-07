import { ConnectionSnippetsSchema } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { connectionSnippets } from './snippets.js';

describe('connectionSnippets', () => {
  test('returns the exact client configurations', () => {
    const token = `dwa_${'a'.repeat(43)}`;
    const appUrl = 'http://localhost:3000';
    const result = connectionSnippets({ appUrl, token });
    expect(ConnectionSnippetsSchema.parse(result)).toEqual({
      claudeDesktop: `${appUrl}/mcp/${token}\nAdd this URL as a custom connector in Claude Desktop (Settings → Connectors → Add custom connector). Treat it as a secret: anyone with the link can act as your agent.`,
      claudeCode: `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`,
      cursor: JSON.stringify(
        {
          mcpServers: {
            dealingwith: { url: `${appUrl}/mcp`, headers: { Authorization: `Bearer ${token}` } },
          },
        },
        null,
        2,
      ),
    });
  });
});
