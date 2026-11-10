import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_IDS } from '../api/fixtures/demo-ids.js';
import { handlers } from '../api/fixtures/handlers.js';
import { hardResetState } from '../api/fixtures/state.js';
import { toStudioSources } from './sources.js';
import { CENTS } from './widgets/money.js';

describe('toStudioSources', () => {
  beforeEach(() => {
    hardResetState();
  });

  it('yields the five sources in order with their ids', () => {
    const { sources } = toStudioSources(handlers.dashboardData());
    expect(sources.map((s) => s.id)).toEqual([
      'quotes',
      'lines',
      'payments',
      'requests',
      'mandates',
    ]);
  });

  it('marks cents fields so the widgets format them with formatUsd', () => {
    const { sources } = toStudioSources(handlers.dashboardData());
    const amount = sources[1].fields.find((f) => f.id === 'amountCents');
    expect(amount).toMatchObject({ format: 'integerFormat', context: CENTS });
    expect(sources[1].fields.find((f) => f.id === 'amountUsd')?.context).toBeUndefined();
    expect(sources[4].fields.filter((f) => f.context === CENTS).map((f) => f.id)).toEqual([
      'spentCents',
      'totalLimitCents',
      'perPurchaseLimitCents',
    ]);
  });

  it('shows coded values in the words the product uses, keeping the values', () => {
    const { sources } = toStudioSources(handlers.dashboardData());
    type Formatter = (value: string) => string;
    const formatterOf = (source: 0 | 1 | 2 | 3 | 4, id: string) => {
      const create = sources[source].fields.find((f) => f.id === id)?.createValueFormatter;
      return create?.(undefined, {} as Parameters<typeof create>[1]) as Formatter | undefined;
    };
    expect(formatterOf(1, 'channel')?.('mcp')).toBe('agent');
    expect(formatterOf(1, 'channel')?.('web')).toBe('web');
    expect(formatterOf(1, 'quoteStatus')?.('needs_info')).toBe('Needs info');
    expect(formatterOf(0, 'status')?.('published')).toBe('Published');
    expect(formatterOf(2, 'mode')?.('pay_now')).toBe('Pay now');
    expect(formatterOf(1, 'label')).toBeUndefined();
  });

  it('gives each payment the channel of the request behind its quote', async () => {
    await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    const data = handlers.dashboardData();
    const quote = data.quotes[0];
    expect(quote).toBeDefined();
    if (!quote) return;
    const { sources } = toStudioSources({
      ...data,
      payments: [
        {
          paymentId: 'd0000000-0000-4000-8000-000000000001',
          quoteId: quote.quoteId,
          version: quote.version,
          mode: 'mandate',
          status: 'captured',
          clientName: quote.clientName,
          projectTitle: quote.projectTitle,
          amountCents: quote.totalCents,
          createdAt: '2026-11-08T15:30:00.000Z',
          capturedAt: '2026-11-08T15:31:00.000Z',
        },
      ],
    });
    expect(sources[2].data[0]?.channel).toBe(quote.channel);
  });

  it('turns the mandate into one row, and none before it exists', () => {
    const data = handlers.dashboardData();
    const id = 'e0000000-0000-4000-8000-000000000001';
    const mandate = {
      id,
      clientId: id,
      businessId: id,
      projectId: id,
      perPurchaseLimitCents: 10000,
      totalLimitCents: 30000,
      spentCents: 6000,
      currency: 'USD' as const,
      expiresAt: '2026-12-31T23:59:59.000Z',
      status: 'active' as const,
      funding: { fundingAmountCents: 30000, fundingCapturedCents: 6000 },
    };
    expect(toStudioSources({ ...data, mandate }).sources[4].data).toEqual([
      {
        mandateId: id,
        status: 'active',
        spentCents: 6000,
        totalLimitCents: 30000,
        perPurchaseLimitCents: 10000,
        expiresOn: '2026-12-31',
      },
    ]);
    expect(toStudioSources({ ...data, mandate: null }).sources[4].data).toEqual([]);
  });

  it('adds dollar columns for charting and keeps the cents', async () => {
    await handlers.createProjectRequest(DEMO_IDS.project, {
      text: 'I need a per-branch view and a summary email every Monday.',
    });
    const { sources } = toStudioSources(handlers.dashboardData());
    const lines = sources[1];
    const paid = lines.data.find((row) => row.amountCents === 8000);
    expect(paid).toBeDefined();
    expect(paid?.amountUsd).toBe(80);
    expect(paid?.amountCents).toBe(8000);
    const quotes = sources[0];
    expect(quotes.data[0]?.totalUsd).toBe(80);
    expect(quotes.data[0]?.totalCents).toBe(8000);
  });

  it('declares every field explicitly so an empty source still has a schema', () => {
    const empty = {
      ...handlers.dashboardData(),
      quotes: [],
      lines: [],
      payments: [],
      requests: [],
    };
    const { sources } = toStudioSources(empty);
    const ids = (i: 0 | 1 | 2 | 3 | 4) => sources[i].fields.map((f) => f.id);
    expect(ids(0)).toEqual(
      expect.arrayContaining(['quoteId', 'status', 'channel', 'totalUsd', 'day']),
    );
    expect(ids(1)).toEqual(
      expect.arrayContaining(['serviceName', 'amountUsd', 'quoteStatus', 'kind', 'ruleId']),
    );
    expect(ids(2)).toEqual(expect.arrayContaining(['paymentId', 'amountUsd', 'capturedAt']));
    expect(ids(3)).toEqual(expect.arrayContaining(['requestId', 'day']));
    const day = sources[3].fields.find((f) => f.id === 'day');
    expect(day?.format).toBe('dateFormat');
  });

  it('turns timestamps into day strings so Studio can group requests over time', () => {
    const { sources } = toStudioSources({
      ...handlers.dashboardData(),
      requests: [
        {
          requestId: 'c0000000-0000-4000-8000-000000000001',
          channel: 'web',
          status: 'quoted',
          clientName: 'Lukas Retail GmbH',
          projectTitle: 'Retail KPI dashboard',
          text: 'x',
          createdAt: '2026-11-08T15:30:00.000Z',
        },
      ],
    });
    expect(sources[3].data[0]?.day).toBe('2026-11-08');
  });
});
