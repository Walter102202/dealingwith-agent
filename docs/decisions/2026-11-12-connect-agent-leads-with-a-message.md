# "Connect my agent" leads with a message for Claude Code

## Context

Until 2026-11-12, "Connect my agent" on the project page showed the token once and four equal fields: the raw token, the Claude Desktop snippet, the Claude Code terminal command and the Cursor JSON. The clients of a service business are rarely technical; a terminal command and a JSON file ask them to know where to run or save each. Walter asked that the screen work for a non-technical client: what they copy should be a message they paste to their AI agent, and the agent does the setup itself. The screen is in the hackathon video recorded on 2026-11-12. Two smaller problems sat on the same card: the Claude Desktop field copied the capability URL together with a sentence of instructions, which does not paste into the connector's URL field, and nothing told the client that Claude Code loads a new server only in a new session.

## Decision

The card shows, in this order: the one-time warning and a sentence that the key spends from the client's budget; a "Message for Claude Code" in plain words with a copy button; the "Connector link" for Claude Desktop and claude.ai (the URL alone, with the Settings → Connectors steps beside it); and a collapsed "Technical setup" with the bare command, the Cursor JSON and the raw token. The message wraps the exact command from the API, tells the agent how to replace an existing `dealingwith` entry, tells it to keep the key secret, and makes it end with one sentence telling the person to close Claude Code and open it again in the same folder. Both the message and the connector link are built in the web (`apps/web/src/lib/agent-setup.ts`) from the `snippets` the API already returns; the contract does not change. What the message assumes about Claude Code was checked on 2026-11-12 against version 2.1.322 and is recorded in `docs/mcp.md`.

## Alternatives considered

- **Add a `claudeCodeMessage` (and a bare connector URL) to `ConnectionSnippetsSchema`.** It keeps every string in `packages/contracts`, but it changes the API of three consumers for text that only the portal shows; no MCP client or test fixture needs the message. Building it in the web from `snippets.claudeCode` keeps the command written once. Revisit if another surface (the landing page, an email) needs the message.
- **Change the default to `--scope user`** so the server works in every folder and no "same folder" instruction is needed. It writes a spending token into the client's global Claude Code configuration, visible to every project they open, and on a machine that already has a user-scoped `dealingwith` it would overwrite it. Local scope is Claude Code's default and the narrower grant.
- **Tell the person to run `/mcp` instead of restarting.** `/mcp reconnect all` is documented only as retrying servers that failed or need authentication, and the test showed the running session did not see the new tools; a restart is the instruction that is known to work.
- **Keep the four fields and add the message as a fifth.** The point is that a non-technical client sees what to do first; equal weight for the terminal command and the JSON defeats it.

## Consequences

A client pastes one message, approves one terminal command when Claude Code asks, and restarts Claude Code once. The interactive terminal was not driven in the test (only `claude -p` sessions), so the restart sentence rests on the non-interactive result and on the docs promising nothing more; if a later Claude Code loads new servers in the running session, the message can drop step 4. The message text lives in one function with a test that pins its key sentences; the README and `docs/mcp.md` quote it and must change with it. The connector link is the first line of `snippets.claudeDesktop`; a test builds the snippets with `connectionSnippets` so a change of that format fails in the web.
