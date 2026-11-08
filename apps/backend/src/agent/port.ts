// Track B replaces this placeholder with the provider-backed agent port.
import type { Env } from '../env.js';
import type { AgentPort } from '../workflows/deps.js';
import { fakeAgentPort } from '../workflows/fake-agent.js';
export function createAgentPort(_env: Env): AgentPort {
  return fakeAgentPort();
}
