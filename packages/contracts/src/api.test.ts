import { describe, expect, test } from 'vitest';
import {
  AppConfigSchema,
  DashboardDataSchema,
  DashboardLineRowSchema,
  ProjectViewSchema,
} from './api.js';

describe('AppConfigSchema', () => {
  test('mock mode needs no client id; sandbox mode carries one', () => {
    const mock = AppConfigSchema.parse({
      paypalMode: 'mock',
      appUrl: 'http://localhost:3000',
      demoMode: true,
    });
    const sandbox = AppConfigSchema.parse({
      paypalMode: 'sandbox',
      paypalClientId: 'AX1',
      appUrl: 'https://dealingwith.example',
      demoMode: true,
    });
    expect(mock.paypalClientId).toBeUndefined();
    expect(sandbox.paypalClientId).toBe('AX1');
  });
});

describe('DashboardDataSchema', () => {
  test('parses an empty dashboard', () => {
    const data = DashboardDataSchema.parse({
      quotes: [],
      lines: [],
      payments: [],
      requests: [],
      services: [],
      mandate: null,
      generatedAt: '2026-11-07T20:00:00.000Z',
    });
    expect(data.lines).toEqual([]);
  });

  test('line rows keep amounts in integer cents', () => {
    const result = DashboardLineRowSchema.safeParse({
      quoteId: 'a0000000-0000-4000-8000-000000000061',
      version: 1,
      quoteStatus: 'paid',
      kind: 'rule',
      label: 'Weekly Monday summary email',
      ruleId: 'S2.report',
      serviceName: 'Automations',
      amountCents: 80.5,
      clientName: 'Lukas Retail GmbH',
      projectTitle: 'Retail KPI dashboard',
      channel: 'web',
      createdAt: '2026-11-07T20:00:00.000Z',
      paidAt: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('ProjectViewSchema', () => {
  test('allows a null mandate and requires the service', () => {
    expect(ProjectViewSchema.shape.mandate.safeParse(null).success).toBe(true);
    expect(ProjectViewSchema.shape.service.safeParse(undefined).success).toBe(false);
  });
});
