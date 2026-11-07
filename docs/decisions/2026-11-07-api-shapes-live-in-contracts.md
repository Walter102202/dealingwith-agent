# API shapes live in contracts

## Context

Phase 1 runs four tracks in parallel. Track A builds the HTTP API, Track C the MCP server and Track D the web client, and all three need the same shapes that Phase 0 did not define: a request, a connected client agent, a demo session, the events streamed over SSE, the project page payload, the dashboard rows and the error envelope. Only the integrator edits `packages/contracts`, so if these shapes were not there before the tracks started, each track would define its own and the merge would have to reconcile three versions.

## Decision

The integrator added them to `@dealingwith/contracts` before handing out the Track A, C and D briefs: `request.ts` (`RequestSchema`, channel and status enums), `access.ts` (`SessionSchema`, `ClientAgentSchema`, `AGENT_SCOPES`, `AgentTokenSchema`, `ConnectionSnippetsSchema`, `IssuedAgentSchema`), `events.ts` (`DomainEventSchema`, five event types) and `api.ts` (`AppConfigSchema`, `ProjectViewSchema`, `ApiErrorSchema`, the dashboard row schemas and `DashboardDataSchema`). `AcceptQuoteReasonSchema` gained `not_acceptable` for versions that are `needs_info`, `draft`, `expired` or `rejected`. Tracks import these and never redefine them.

## Alternatives considered

- **Each track defines what it needs locally and the integrator reconciles at merge.** Cheapest now, but three sources of truth for the same payload during the four days when the tracks cannot see each other.
- **Derive the API types from the Drizzle schema (`$inferSelect`).** Ties the wire format to the database (`Date` objects, `quote_id` vs `id`, token hashes) and gives the web a dependency on the backend package.

## Consequences

- The web, the API and the MCP server validate the same objects with the same schemas; a judge sees one `Quote`, one `Payment`, one `DomainEvent`.
- Backend modules need mappers from database rows to these shapes (dates to ISO strings, `quoteId` to `id`, optional fields omitted rather than `undefined`); Track A owns them.
- Dashboard rows keep amounts in cents and flatten one row per quote line, so AG Studio can group revenue and unpaid additionals by service without the web recomputing prices.
- Adding a field later is a contracts change by the integrator plus a decision file, as before.
