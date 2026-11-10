import { type DashboardData, type DashboardLineRow, formatUsd } from '@dealingwith/contracts';
import type { AgAiTool, AgAiToolResult } from 'ag-studio';
import { z } from 'zod';

/**
 * The Collections agent's data and tools. The model chooses the client and
 * writes the words; every amount, quote reference and total in a reminder is
 * rendered here from the dashboard data (integer cents, `formatUsd`), never
 * from model output (CONSTITUTION Article II.2, decision
 * 2026-11-10-collections-agent-amounts-from-data).
 */

/** The "Unpaid additionals" widget's rule: priced extra lines on quotes not yet paid. */
const UNPAID_STATUSES: ReadonlySet<string> = new Set(['published', 'accepted']);

export type UnpaidLine = {
  quoteId: string;
  version: number;
  quoteRef: string;
  quoteStatus: string;
  label: string;
  amountCents: number;
};

export type ClientUnpaid = {
  clientName: string;
  projects: string[];
  lines: UnpaidLine[];
  totalCents: number;
};

/** `Q-1A2B3C4D v2`: a short, stable reference to one quote version. */
export const quoteRef = (quoteId: string, version: number) =>
  `Q-${quoteId.slice(0, 8).toUpperCase()} v${version}`;

export function unpaidAdditionals(lines: DashboardLineRow[]): ClientUnpaid[] {
  const byClient = new Map<string, ClientUnpaid>();
  for (const line of lines) {
    if (line.kind !== 'rule' || !UNPAID_STATUSES.has(line.quoteStatus)) continue;
    const client = byClient.get(line.clientName) ?? {
      clientName: line.clientName,
      projects: [],
      lines: [],
      totalCents: 0,
    };
    if (line.projectTitle && !client.projects.includes(line.projectTitle))
      client.projects.push(line.projectTitle);
    client.lines.push({
      quoteId: line.quoteId,
      version: line.version,
      quoteRef: quoteRef(line.quoteId, line.version),
      quoteStatus: line.quoteStatus,
      label: line.label,
      amountCents: line.amountCents,
    });
    client.totalCents += line.amountCents;
    byClient.set(line.clientName, client);
  }
  return [...byClient.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** What the model may write: words only. Unknown keys (an `amountCents`, a `total`) are dropped. */
const WordingSchema = z.object({
  clientName: z.string().trim().min(1),
  greeting: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1500),
  signOff: z.string().trim().min(1).max(200),
});

/** Currency amounts in prose: `$120`, `US$ 1,200.00`, `120 USD`, `45.50`. */
const MONEY =
  /(?:US\$|\$|USD|€|£)\s?\d|\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|dollars?|cents?)\b|\b\d+\.\d{2}\b/i;

export type Reminder = {
  clientName: string;
  greeting: string;
  message: string;
  signOff: string;
  lines: UnpaidLine[];
  totalCents: number;
  text: string;
};

export type ComposeResult = { ok: true; reminder: Reminder } | { ok: false; issues: string[] };

export function composeReminder(data: DashboardData, args: unknown): ComposeResult {
  const parsed = WordingSchema.safeParse(args);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  const wording = parsed.data;
  const withAmounts = (['greeting', 'message', 'signOff'] as const).filter((key) =>
    MONEY.test(wording[key]),
  );
  if (withAmounts.length)
    return {
      ok: false,
      issues: withAmounts.map(
        (key) =>
          `${key}: write it without amounts or totals; the itemised amounts and the total are added from the quote data`,
      ),
    };
  const clients = unpaidAdditionals(data.lines);
  const client = clients.find(
    (c) => c.clientName.toLowerCase() === wording.clientName.toLowerCase(),
  );
  if (!client)
    return {
      ok: false,
      issues: [
        `clientName: no unpaid additionals for "${wording.clientName}". Clients with unpaid additionals: ${
          clients.map((c) => c.clientName).join(', ') || 'none'
        }`,
      ],
    };
  const { greeting, message, signOff } = wording;
  return {
    ok: true,
    reminder: {
      clientName: client.clientName,
      greeting,
      message,
      signOff,
      lines: client.lines,
      totalCents: client.totalCents,
      text: renderReminder({ greeting, message, signOff }, client),
    },
  };
}

function renderReminder(
  wording: { greeting: string; message: string; signOff: string },
  client: ClientUnpaid,
): string {
  const items = client.lines.map(
    (line) => `- ${line.quoteRef} · ${line.label}: ${formatUsd(line.amountCents)}`,
  );
  return [
    wording.greeting,
    wording.message,
    ['Outstanding additionals:', ...items, `Total due: ${formatUsd(client.totalCents)}`].join('\n'),
    wording.signOff,
  ].join('\n\n');
}

type GetData = () => DashboardData | null;

const NO_DATA: AgAiToolResult = {
  success: false,
  issues: [{ message: 'The dashboard data is not loaded yet' }],
};

export function listUnpaidTool(getData: GetData): AgAiTool {
  const name = 'list_unpaid_additionals';
  const description =
    'Lists unpaid additionals (priced extra lines on quotes that are published or accepted but not yet paid), grouped by client with amounts and totals, largest balance first.';
  return {
    name,
    description,
    kind: 'client',
    schema: () => ({
      name,
      description,
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Only this client. Omit for every client.' },
        },
        additionalProperties: false,
      },
    }),
    async execute(call) {
      const data = getData();
      if (!data) return NO_DATA;
      const only =
        typeof call.args.clientName === 'string' ? call.args.clientName.toLowerCase() : null;
      const clients = unpaidAdditionals(data.lines).filter(
        (c) => !only || c.clientName.toLowerCase() === only,
      );
      const view = clients.map((c) => ({
        clientName: c.clientName,
        projects: c.projects,
        totalDue: formatUsd(c.totalCents),
        lines: c.lines.map((l) => ({
          quote: l.quoteRef,
          status: l.quoteStatus,
          item: l.label,
          amount: formatUsd(l.amountCents),
        })),
      }));
      return {
        success: true,
        response: JSON.stringify({ clients: view }),
        data: { clients: view.length },
      };
    },
  };
}

export const DRAFT_REMINDER_TOOL = 'draft_payment_reminder';

export function draftReminderTool(getData: GetData): AgAiTool {
  const description =
    "Drafts a payment reminder for one client's unpaid additionals. You write only the words; the itemised quote references, amounts and total are filled in from the quote data. Never put amounts in the words. The draft is shown to the user; nothing is sent.";
  const text = (about: string) => ({ type: 'string', description: about });
  return {
    name: DRAFT_REMINDER_TOOL,
    description,
    kind: 'client',
    schema: () => ({
      name: DRAFT_REMINDER_TOOL,
      description,
      parameters: {
        type: 'object',
        properties: {
          clientName: text('The client, exactly as list_unpaid_additionals names it.'),
          greeting: text('Opening line, e.g. "Hi Mara,".'),
          message: text('One or two short, friendly paragraphs. No amounts, no totals.'),
          signOff: text('Closing line and signature.'),
        },
        required: ['clientName', 'greeting', 'message', 'signOff'],
        additionalProperties: false,
      },
    }),
    async execute(call) {
      const data = getData();
      if (!data) return NO_DATA;
      const result = composeReminder(data, call.args);
      if (!result.ok)
        return { success: false, issues: result.issues.map((message) => ({ message })) };
      const { reminder } = result;
      return {
        success: true,
        response: `Draft ready for ${reminder.clientName}: ${reminder.lines.length} line(s), total ${formatUsd(reminder.totalCents)}. It is shown to the user in this step with the amounts filled in from the quote data; do not restate or recompute them.`,
        data: reminder,
      };
    },
  };
}
