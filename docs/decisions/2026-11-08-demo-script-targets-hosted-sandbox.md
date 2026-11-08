# 2026-11-08 Demo script targets the hosted sandbox, with Claude Code as the agent

## Context

Task E2 writes `docs/demo-script.md` before Phase 2 exists. The script could describe the local mock (approve page under `/mock-paypal`, mock model) or the hosted deployment (PayPal sandbox popup, real model). The design's storyboard also leaves the agent client open ("Claude Desktop or Claude Code") and the plan's "under 170 seconds" budget does not fit a live token hand-off into a desktop app.

## Decision

The script is written for the hosted URL with `PAYPAL_MODE=sandbox` and a real model, because that is where the video is recorded (Task S2 follows I4). The agent client is Claude Code: its connection is one command, so the recording pauses once after "Connect my agent" to run the printed snippet and resumes. The two agent prompts are literal in the script so the recording, the mock fixtures (`apps/backend/src/agent/mock-fixtures.ts`) and the live eval (`evals/live/cases.ts`) use the same request texts.

## Alternatives considered

- Script the local mock flow: no PayPal popup, no real model, so the video would not show what judges test; rejected.
- Claude Desktop as the agent client: the capability URL must be pasted into Settings → Connectors, which costs about 20 seconds on camera; rejected for time, documented in `docs/mcp.md` for judges who prefer it.
- Pre-issue the token off camera and skip "Connect my agent": hides the consent step the mandate model is built on; rejected.

## Consequences

- The script cannot be rehearsed end to end until I4 lands; the dry run is Tuesday 2026-11-11 in the calendar.
- Test counts in shot 9 are the counts of the day; the script says so.
- If the sandbox popup turns out slower than its 16-second budget, the shot is cut in editing, not re-scripted.
