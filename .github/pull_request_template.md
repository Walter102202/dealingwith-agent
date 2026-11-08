## What and why

<!-- One paragraph: the task (plan id if any), what changes for a user or an agent, and why now. -->

## How it was verified

<!-- Paste the last lines of `pnpm test` and name any manual check (browser, MCP smoke, sandbox). -->

## Checklist (Constitution, Articles II–V)

- [ ] No invariant touched, or the change to it is explained above.
- [ ] Tests named by the task exist and pass; new behaviour has a test beside it.
- [ ] `docs/milestones.md` ticked; decision file(s) in `docs/decisions/` and indexed, if a decision was taken.
- [ ] No secret, `.env` or `docs/hackathon/` content in the diff.
- [ ] Schema change ships its migration (`db:generate` produces no diff).
- [ ] Reviewed by someone who did not write it (name or agent run below), findings verified at file:line.

## Review record

<!-- Who reviewed, what they found, what was fixed or dismissed and why. -->
