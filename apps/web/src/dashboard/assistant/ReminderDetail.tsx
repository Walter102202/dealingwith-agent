import { formatUsd } from '@dealingwith/contracts';
import type { AgAiToolDetailParams } from 'ag-studio';
import type { AgAiToolDisplay } from 'ag-studio-react';
import { z } from 'zod';
import { DRAFT_REMINDER_TOOL } from './collections.js';
import styles from './ReminderDetail.module.css';
import { ReminderDraft } from './ReminderDraft.js';

/** The draft as the tool returned it; amounts are cents rendered by code. */
const ReminderSchema = z.object({
  clientName: z.string(),
  greeting: z.string(),
  message: z.string(),
  signOff: z.string(),
  lines: z.array(
    z.object({
      quoteRef: z.string(),
      label: z.string(),
      amountCents: z.number().int().nonnegative(),
    }),
  ),
  totalCents: z.number().int().nonnegative(),
});

const reminderOf = (result: unknown) => {
  const parsed = z.object({ success: z.literal(true), data: ReminderSchema }).safeParse(result);
  return parsed.success ? parsed.data.data : null;
};

/**
 * The payment reminder draft in the chat, under the Collections step. Studio
 * keeps tool steps collapsed, so the page also shows the latest draft above
 * the report (`ReminderDraftCard`); this keeps it in the conversation history.
 */
export function ReminderDetail(props: AgAiToolDetailParams) {
  const reminder = reminderOf(props.result);
  if (!reminder) return <p className={styles.note}>Drafting the reminder…</p>;
  return <ReminderDraft reminder={reminder} />;
}

const clientCount = (n: number) => `${n} ${n === 1 ? 'client' : 'clients'}`;

/** How the Collections tools read in the chat panel (`aiToolDisplay`, keyed by tool name). */
export const ASSISTANT_TOOL_DISPLAY: Record<string, AgAiToolDisplay> = {
  [DRAFT_REMINDER_TOOL]: {
    label: ({ args, status, result }) => {
      const reminder = reminderOf(result);
      const client = typeof args.clientName === 'string' ? args.clientName : 'a client';
      return {
        text:
          status === 'done' && reminder
            ? `Payment reminder for ${reminder.clientName}`
            : `Drafting a reminder for ${client}`,
        ...(reminder ? { pill: formatUsd(reminder.totalCents) } : {}),
      };
    },
    detail: ReminderDetail,
  },
  list_unpaid_additionals: {
    label: ({ result }) => {
      const count = z
        .object({ success: z.literal(true), data: z.object({ clients: z.number() }) })
        .safeParse(result);
      return {
        text: 'Looking up unpaid additionals',
        ...(count.success ? { pill: clientCount(count.data.data.clients) } : {}),
      };
    },
  },
};
