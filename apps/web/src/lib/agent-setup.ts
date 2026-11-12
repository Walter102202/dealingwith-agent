import type { ConnectionSnippets } from '@dealingwith/contracts';

/**
 * The message a client pastes into Claude Code so the agent connects itself.
 * It wraps the exact `claude mcp add` command the API returns. What it tells
 * the agent follows what was checked on Claude Code 2.1.322 (2026-11-12,
 * `docs/mcp.md`): the agent runs the command with its terminal tool, the
 * server lands in the local scope (this folder only), the add fails when a
 * `dealingwith` server already exists there, and the tools appear only in a
 * new session started in the same folder.
 */
export function claudeCodeMessage(snippets: Pick<ConnectionSnippets, 'claudeCode'>): string {
  return [
    'Please connect yourself to DealingWith, where I order work from my service provider. Once connected, you can request quotes for me and pay them within the budget I approved.',
    '1. Run this command in the terminal. It saves the connection for this folder:',
    snippets.claudeCode,
    '2. If it says dealingwith already exists, run `claude mcp remove dealingwith -s local`, then run the command above again.',
    '3. The part that starts with dwa_ is a secret key. Do not repeat it in your replies or save it anywhere else.',
    '4. When it works, tell me in one sentence that I need to close Claude Code and open it again in this same folder before you can use DealingWith.',
  ].join('\n\n');
}

/**
 * The capability URL for Claude Desktop and claude.ai custom connectors.
 * `connectionSnippets` puts it alone on the first line of `claudeDesktop` and
 * the instructions after it; the connector field takes the URL only.
 */
export function connectorUrl(snippets: Pick<ConnectionSnippets, 'claudeDesktop'>): string {
  return snippets.claudeDesktop.split('\n')[0]?.trim() ?? '';
}
