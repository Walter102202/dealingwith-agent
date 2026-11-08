import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_IDS } from '../api/fixtures/demo-ids.js';
import { handlers } from '../api/fixtures/handlers.js';
import { hardResetState } from '../api/fixtures/state.js';
import { toStudioSources } from './sources.js';

describe('toStudioSources', () => {
  beforeEach(() => {
    hardResetState();
  });

  it('yields the four sources in order with their ids', () => {
    const { sources } = toStudioSources(handlers.dashboardData());
    expect(sources.map((s) => s.id)).toEqual(['quotes', 'lines', 'payments', 'requests']);
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
    const ids = (i: 0 | 1 | 2 | 3) => sources[i].fields.map((f) => f.id);
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
