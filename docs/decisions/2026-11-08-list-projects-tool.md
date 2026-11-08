# A `list_projects` MCP tool so agents can find a project id

## Context

The spec's eight MCP tools let an agent read a project (`get_project`) and request work on it (`request_quote` with `projectId`), but none of them tells the agent which projects exist or what their ids are. The portal snippets carry only the token, `get_mandate` printed no project id in its text, and `list_services` prints service ids only. The demo prompt ("request a quote on the Retail KPI dashboard project") therefore depended on the agent guessing a UUID; without it, `request_quote` creates a storefront quote and `accept_quote` denies it with `wrong_project`. Found by the independent review of Track E's docs (2026-11-08).

## Decision

Add a ninth read-only tool, `list_projects`, that returns the agent's client's projects (id, title, status, contracted amount, scope clauses) as `structuredContent` and as Markdown that repeats the ids. Its description tells the model to call it first. `get_mandate` also prints `Project: <id>` in its text. Scope is the same as every other tool: the authenticated agent's client only.

## Alternatives considered

- Put the project UUID in the demo prompts and the README judge path. Works for the video but makes every judge type a UUID and leaves the product gap.
- Default `request_quote` without `projectId` to the client's only project. Changes the documented meaning ("without it, a new engagement") and breaks for clients with several projects.
- Print the project id in the connection snippets. Helps a human, not an agent that joins later or serves several projects.

## Consequences

Contracts, server, tests and `docs/mcp.md` list nine tools. Track E's architecture page said "eight tools" and is corrected before its merge. The demo prompt can keep naming the project in words.
