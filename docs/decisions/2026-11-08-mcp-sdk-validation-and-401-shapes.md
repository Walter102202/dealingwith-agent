# MCP tests pin the SDK 1.32.2 shapes for invalid input and 401

## Context

The Track C plan assumed two behaviours of `@modelcontextprotocol/sdk@1.32.2` that the installed package does not have. First, an input that fails the tool's Zod schema was expected to surface on the client as a rejected `callTool` promise (a JSON-RPC `InvalidParams` error). The SDK instead returns a tool result with `isError: true` whose text is `MCP error -32602: Input validation error: Invalid arguments for tool request_quote: text is required at text`; the handler still never runs. Second, an HTTP 401 from the server was expected to reject `client.connect` with a message containing `401`. The SDK's `StreamableHTTPClientTransport` throws `StreamableHTTPError` with the status in `error.code` and only the response body in `error.message`.

## Decision

The tests assert what the SDK actually does: an empty `request_quote` yields `isError: true` with a message matching `text is required` and leaves the quote count unchanged; an unknown or revoked token rejects `connect` with `{ code: 401, message: /invalid token/ }`, and a raw HTTP request to `/mcp` is also asserted to return status 401 with the documented error body. Review Focus 5 (nothing persisted, the Zod message reaches the caller, 401 before any MCP parsing) is covered as written in the spec.

## Alternatives considered

- Wrapping handlers to re-throw validation errors as JSON-RPC errors: fights the SDK, and every real client already renders `isError` results to the model.
- Asserting only on the message regex `/401/`: would fail forever against this SDK version; the status is in `code`.

## Consequences

If a later SDK changes either shape, these two tests fail loudly and point here. `docs/mcp.md` documents that invalid input comes back as an error result, not a protocol error, so agent authors read the text rather than catching exceptions.
