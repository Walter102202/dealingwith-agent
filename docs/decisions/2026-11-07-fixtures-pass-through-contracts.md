# Fixtures mode answers through the same contracts schemas as HTTP

## Context

Track D builds the web before the HTTP API is on `main`. The plan gives the web a fixtures mode: `VITE_API_MODE=fixtures` routes every call of the API client to an in-memory demo. The question was whether fixture responses skip the schema parsing the client applies to real responses.

## Decision

No. `client.ts` parses fixture responses with the same `@dealingwith/contracts` schema it would apply to a `fetch` body, and fixture failures are thrown as the same `ApiRequestError`. A consequence: the fixtures' `approvalUrl` values are absolute (`window.location.origin + '/pay/return?token=…'`), because `AcceptQuoteResultSchema` requires a URL, while the plan's sketch wrote them as paths.

## Alternatives considered

- Return fixture objects unparsed: faster to write, but a fixture could drift from the contracts without any test noticing, and the switch to the real API would surface the drift as UI bugs.
- Keep relative approval URLs and relax the schema: the contracts are the integrator's and the backend already returns absolute URLs from the mock gateway.

## Consequences

Every page is exercised against validated shapes from day one; switching `VITE_API_MODE` to `http` changes transport only. `fixtures.test.ts` validates the fixture objects directly as a second guard.
