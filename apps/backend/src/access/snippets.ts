import type { ConnectionSnippets } from '@dealingwith/contracts';
export function connectionSnippets({
  appUrl,
  token,
}: {
  appUrl: string;
  token: string;
}): ConnectionSnippets {
  return {
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
  };
}
