# Serialize quote versions on the request

## Context

Concurrent answers can both read the same latest quote version. Locking existing quote rows alone does not protect allocation before the first version exists.

## Decision

Lock the owning request row before allocating a quote version and superseding previous versions. Reject a quote id that belongs to another request.

## Alternatives considered

- Retry unique-key violations: more complicated failure handling when a stable parent row already exists.
- An in-process mutex: does not protect multiple server processes.

## Consequences

Version allocation is serialized in the database without schema changes. Concurrent allocation is covered by a repository test.
