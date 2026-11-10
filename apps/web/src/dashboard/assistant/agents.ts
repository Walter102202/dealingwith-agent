import type { DashboardData } from '@dealingwith/contracts';
import {
  type AgAnyAiAgentDefinition,
  type AgAnyAiAgentRunner,
  type AgLlmAdapter,
  directLlmRunner,
} from 'ag-studio';
import { draftReminderTool, listUnpaidTool } from './collections.js';

export const COLLECTIONS_AGENT = 'collections';

/** The delegates AG's lead ships with, plus ours. */
const LEAD_DELEGATES = ['data', 'widget', 'page', 'planning', COLLECTIONS_AGENT];

/** Where the Collections agent reads the dashboard rows and who it writes for, at call time. */
export type CollectionsSource = {
  data: () => DashboardData | null;
  providerName: () => string | null;
};

function collectionsInstructions(providerName: string | null): string {
  const provider = providerName ?? 'the provider';
  return `You are the Collections agent for ${provider}, a service business that quotes and gets paid through DealingWith. You help ${provider} collect unpaid additionals: priced extra lines on quotes that are published or accepted but not yet paid.

## Tools
- list_unpaid_additionals: who owes what, by client, largest balance first. Call it before answering any question about balances or before drafting a reminder.
- draft_payment_reminder: drafts a reminder for one client. You write only the greeting, the message and the sign-off. The quote references, line amounts and total are added by code from the quote data.

## Rules
- Never write, compute, round or restate an amount, a total or a quote reference in the wording you pass to draft_payment_reminder. The tool rejects wording that contains amounts.
- Keep the tone warm and brief: thank the client, say which work the additionals cover in words, ask them to settle through the project page with PayPal. Two short paragraphs at most.
- Write as ${provider} and sign off with that name. DealingWith is only the platform: never sign as DealingWith.
- If no client is named, pick the one with the largest balance and say so.
- The draft is only shown to the provider; nothing is sent. Say that the draft is ready in the step above, without repeating it.
- When you were delegated a task, finish by calling complete_task with a one-sentence summary that names the client and says the draft is ready, without amounts.`;
}

const COLLECTIONS_ROUTING = `## Collections delegate (type: 'collections')
Finds unpaid additionals (priced extra lines on quotes that are published or accepted but not yet paid) and drafts payment reminders for a client. Route here: who owes us, unpaid additionals by client, chasing or reminding a client, drafting a payment reminder. Charts of unpaid additionals still go to Page then Widget.
Reminder amounts and totals are filled in by code from the quote data: never write or recompute them yourself. When Collections reports a draft, tell the user it is ready in the Collections step and offer to adjust the tone.`;

/** AG's lead, able to delegate to Collections as well. */
export function leadWithCollections(lead: AgAnyAiAgentDefinition): AgAnyAiAgentDefinition {
  return {
    ...lead,
    instructions: (ctx, params) =>
      [lead.instructions?.(ctx, params), COLLECTIONS_ROUTING].filter(Boolean).join('\n\n'),
    tools: (ctx, params) => {
      const tools = (lead.tools?.(ctx, params) ?? []).filter((tool) => tool.name !== 'delegate_to');
      return [...tools, ctx.tools.delegateTo(LEAD_DELEGATES)];
    },
  };
}

/**
 * A custom agent next to AG's built-ins. The lead reaches it by delegation; AG
 * Studio 3.1.0's chat panel always starts threads with the primary agent, so it
 * is not offered as a starting agent there.
 */
export function collectionsAgent(
  adapter: AgLlmAdapter,
  source: CollectionsSource,
): AgAnyAiAgentRunner {
  return directLlmRunner({
    id: COLLECTIONS_AGENT,
    name: 'Collections',
    description:
      'Finds unpaid additionals by client and drafts payment reminders whose amounts are filled in from the quote data.',
    instructions: () => collectionsInstructions(source.providerName()),
    tools: () => [listUnpaidTool(source.data), draftReminderTool(source.data)],
    maxTurns: 8,
    adapter,
  });
}
