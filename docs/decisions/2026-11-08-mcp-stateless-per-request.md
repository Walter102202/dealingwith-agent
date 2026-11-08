# MCP endpoint: stateless Streamable HTTP, one server per request

## Context

Spec section 7.6 exposes eight MCP tools over Streamable HTTP from the same Hono process as the JSON API, authenticated by an agent token in the `Authorization` header or in a capability URL. The identity (which `ClientAgent` is calling) changes per request, and the hackathon demo connects Claude Desktop, Claude Code and Cursor, none of which require SSE resumption. `@hono/mcp@0.3.5` wraps the SDK transport for Hono; `@modelcontextprotocol/sdk@1.32.2` documents the stateless mode with `sessionIdGenerator: undefined`.

## Decision

Every HTTP request to `/mcp` or `/mcp/:token` authenticates the token first, then builds a fresh `McpServer` bound to that agent and a fresh `StreamableHTTPTransport({ sessionIdGenerator: undefined })`, connects them, handles the request and discards both. No session ids, no session store, no standalone GET stream. Scope checks live in `src/mcp/scope.ts`; tools reuse the workflows and repositories unchanged.

## Alternatives considered

- One long-lived `McpServer` shared by all agents (the `@hono/mcp` README shape): tools would have to read the identity from request context on every call, and a bug there leaks one client's data to another.
- Stateful sessions with `sessionIdGenerator: randomUUID` and an in-memory map: supports SSE resumption and server notifications we do not use, and breaks on Render restarts or more than one instance.
- The SDK's own OAuth router (`mcpAuthRouter`): the production path named in the spec, out of scope for the MVP; tokens issued in the portal are the demo's auth.

## Consequences

Each request pays the cost of registering eight tools and one resource (microseconds; no I/O). No notifications or progress streams to clients. Horizontal scaling and restarts need nothing. Tests drive the server through `app.request` as the client's `fetch`, without opening a port.
