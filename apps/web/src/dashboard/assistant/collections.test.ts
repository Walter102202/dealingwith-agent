import type { DashboardData, DashboardLineRow } from '@dealingwith/contracts';
import type { AgAiToolContext } from 'ag-studio';
import { describe, expect, it } from 'vitest';
import {
  composeReminder,
  draftReminderTool,
  listUnpaidTool,
  quoteRef,
  unpaidAdditionals,
} from './collections.js';

const Q1 = '7f3a2c10-0000-4000-8000-000000000001';
const Q2 = '9b1e4d20-0000-4000-8000-000000000002';
const Q3 = 'c0ffee00-0000-4000-8000-000000000003';

function line(overrides: Partial<DashboardLineRow>): DashboardLineRow {
  return {
    quoteId: Q1,
    version: 1,
    quoteStatus: 'published',
    kind: 'rule',
    label: 'Extra report pages',
    ruleId: 'S2.report',
    serviceName: 'Monthly analytics',
    amountCents: 12000,
    clientName: 'Mara Lopez',
    projectTitle: 'Q4 dashboard',
    channel: 'web',
    createdAt: '2026-11-07T12:00:00.000Z',
    paidAt: null,
    ...overrides,
  };
}

const data: DashboardData = {
  quotes: [],
  payments: [],
  requests: [],
  services: [],
  mandate: null,
  generatedAt: '2026-11-10T12:00:00.000Z',
  lines: [
    line({}),
    line({
      quoteId: Q2,
      version: 2,
      quoteStatus: 'accepted',
      label: 'Rush delivery',
      amountCents: 4550,
      channel: 'mcp',
    }),
    line({ quoteId: Q3, label: 'Paid already', quoteStatus: 'paid' }),
    line({ label: 'Included clause', kind: 'included', amountCents: 0 }),
    line({ quoteId: Q3, label: 'Old version', quoteStatus: 'superseded' }),
    line({
      clientName: 'Acme Corp',
      projectTitle: null,
      label: 'Extra endpoint',
      amountCents: 9900,
    }),
  ],
};

const wording = {
  clientName: 'mara lopez',
  greeting: 'Hi Mara,',
  message:
    'Thanks for the extra work on the Q4 dashboard. When you have a moment, please settle it from the project page with PayPal.',
  signOff: 'Best, Andes Data Studio',
};

describe('unpaidAdditionals', () => {
  it('keeps priced lines on published or accepted quotes, by client, largest balance first', () => {
    expect(unpaidAdditionals(data.lines)).toEqual([
      {
        clientName: 'Mara Lopez',
        projects: ['Q4 dashboard'],
        totalCents: 16550,
        lines: [
          {
            quoteId: Q1,
            version: 1,
            quoteRef: 'Q-7F3A2C10 v1',
            quoteStatus: 'published',
            label: 'Extra report pages',
            amountCents: 12000,
          },
          {
            quoteId: Q2,
            version: 2,
            quoteRef: 'Q-9B1E4D20 v2',
            quoteStatus: 'accepted',
            label: 'Rush delivery',
            amountCents: 4550,
          },
        ],
      },
      expect.objectContaining({ clientName: 'Acme Corp', projects: [], totalCents: 9900 }),
    ]);
    expect(quoteRef(Q3, 3)).toBe('Q-C0FFEE00 v3');
  });
});

describe('composeReminder', () => {
  it('renders every amount, quote reference and the total from the data', () => {
    const result = composeReminder(data, wording);
    if (!result.ok) throw new Error(result.issues.join('; '));
    expect(result.reminder).toMatchObject({ clientName: 'Mara Lopez', totalCents: 16550 });
    expect(result.reminder.text).toBe(
      [
        'Hi Mara,',
        wording.message,
        'Outstanding additionals:\n- Q-7F3A2C10 v1 · Extra report pages: US$120.00\n- Q-9B1E4D20 v2 · Rush delivery: US$45.50\nTotal due: US$165.50',
        'Best, Andes Data Studio',
      ].join('\n\n'),
    );
  });

  it('an amount the model tries to supply cannot change the itemised amounts or the total', () => {
    // Amounts smuggled in as extra arguments are dropped by the wording schema.
    const smuggled = composeReminder(data, {
      ...wording,
      amountCents: 1,
      totalCents: 1,
      total: 'US$0.01',
      lines: [{ quoteRef: 'Q-7F3A2C10 v1', label: 'Extra report pages', amountCents: 1 }],
    });
    if (!smuggled.ok) throw new Error(smuggled.issues.join('; '));
    expect(smuggled.reminder.lines.map((l) => l.amountCents)).toEqual([12000, 4550]);
    expect(smuggled.reminder.totalCents).toBe(16550);
    expect(smuggled.reminder.text).not.toContain('0.01');
    expect(smuggled).toEqual(composeReminder(data, wording));

    // Amounts written into the words are refused, so no second figure can appear beside the real one.
    for (const message of [
      'You owe $1.00 for the extra pages.',
      'Your balance is US$ 165.50.',
      'Please pay 20 USD today.',
      'The total is 165.50.',
      'That comes to 99 dollars.',
    ]) {
      const result = composeReminder(data, { ...wording, message });
      expect(result).toEqual({
        ok: false,
        issues: [expect.stringMatching(/^message: write it without amounts/)],
      });
    }
    expect(composeReminder(data, { ...wording, signOff: 'Thanks! $5 off next time' }).ok).toBe(
      false,
    );
  });

  it('names the clients that do owe when the model picks one that does not', () => {
    expect(composeReminder(data, { ...wording, clientName: 'Nobody Inc' })).toEqual({
      ok: false,
      issues: [
        'clientName: no unpaid additionals for "Nobody Inc". Clients with unpaid additionals: Mara Lopez, Acme Corp',
      ],
    });
    expect(composeReminder(data, { clientName: 'Mara Lopez' }).ok).toBe(false);
  });
});

const ctx = {} as AgAiToolContext;
const call = (name: string, args: Record<string, unknown>) => ({ toolCallId: 't1', name, args });

describe('Collections tools', () => {
  it('draft_payment_reminder returns the code-rendered draft and tells the model not to restate it', async () => {
    const tool = draftReminderTool(() => data);
    expect(tool.schema()?.parameters).toMatchObject({
      required: ['clientName', 'greeting', 'message', 'signOff'],
    });
    const result = await tool.execute?.(call(tool.name, wording), ctx);
    expect(result).toMatchObject({
      success: true,
      response: expect.stringContaining('total US$165.50'),
      data: { clientName: 'Mara Lopez', totalCents: 16550 },
    });
    const refused = await tool.execute?.(call(tool.name, { ...wording, message: 'Pay $5' }), ctx);
    expect(refused).toMatchObject({
      success: false,
      issues: [{ message: expect.stringContaining('without amounts') }],
    });
  });

  it('draft_payment_reminder hands the page each finished draft, amounts from the data', async () => {
    const drafts: unknown[] = [];
    const tool = draftReminderTool(
      () => data,
      (reminder) => drafts.push(reminder),
    );
    await tool.execute?.(call(tool.name, { ...wording, message: 'Pay $5' }), ctx);
    expect(drafts).toEqual([]);
    await tool.execute?.(call(tool.name, { ...wording, totalCents: 1 }), ctx);
    expect(drafts).toEqual([
      expect.objectContaining({
        clientName: 'Mara Lopez',
        greeting: wording.greeting,
        totalCents: 16550,
        lines: [
          expect.objectContaining({ quoteRef: 'Q-7F3A2C10 v1', amountCents: 12000 }),
          expect.objectContaining({ quoteRef: 'Q-9B1E4D20 v2', amountCents: 4550 }),
        ],
      }),
    ]);
  });

  it('list_unpaid_additionals formats the balances with formatUsd and filters by client', async () => {
    const tool = listUnpaidTool(() => data);
    const all = await tool.execute?.(call(tool.name, {}), ctx);
    expect(all?.success && JSON.parse(all.response)).toMatchObject({
      clients: [
        {
          clientName: 'Mara Lopez',
          totalDue: 'US$165.50',
          lines: [{ quote: 'Q-7F3A2C10 v1', amount: 'US$120.00' }, {}],
        },
        { clientName: 'Acme Corp', totalDue: 'US$99.00' },
      ],
    });
    const one = await tool.execute?.(call(tool.name, { clientName: 'ACME CORP' }), ctx);
    expect(one).toMatchObject({ success: true, data: { clients: 1 } });
    const unloaded = await listUnpaidTool(() => null).execute?.(call(tool.name, {}), ctx);
    expect(unloaded).toMatchObject({ success: false });
  });
});
