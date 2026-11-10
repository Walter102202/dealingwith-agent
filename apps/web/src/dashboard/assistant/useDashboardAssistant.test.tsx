import { renderHook } from '@testing-library/react';
import { AgStudioAiModule } from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';

const configState = vi.hoisted(() => ({
  current: { data: null, error: null, loading: true } as {
    data: { assistant: { enabled: boolean } } | null;
    error: unknown;
    loading: boolean;
  },
}));
vi.mock('../../api/config.js', () => ({ useAppConfig: () => configState.current }));
vi.mock('../../session.js', () => ({
  useSession: () => ({
    session: { role: 'provider', businessId: 'business', name: 'Andes Data Studio' },
    status: 'ready',
  }),
}));

import { useDashboardAssistant } from './useDashboardAssistant.js';

describe('useDashboardAssistant', () => {
  it('waits for the config, because Studio reads its AI harness once', () => {
    configState.current = { data: null, error: null, loading: true };
    expect(renderHook(() => useDashboardAssistant(null)).result.current).toBeNull();
  });

  it('adds nothing when the assistant is off or the config failed', () => {
    configState.current = { data: { assistant: { enabled: false } }, error: null, loading: false };
    expect(renderHook(() => useDashboardAssistant(null)).result.current).toEqual({});
    configState.current = { data: null, error: new Error('down'), loading: false };
    expect(renderHook(() => useDashboardAssistant(null)).result.current).toEqual({});
  });

  it('registers the AI module, the harness and the reminder display when on, once', () => {
    configState.current = { data: { assistant: { enabled: true } }, error: null, loading: false };
    const { result, rerender } = renderHook(() => useDashboardAssistant(null));
    const first = result.current;
    expect(first?.modules).toEqual([AgStudioAiModule]);
    expect(typeof first?.ai).toBe('function');
    expect(Object.keys(first?.aiToolDisplay ?? {})).toEqual([
      'draft_payment_reminder',
      'list_unpaid_additionals',
    ]);
    rerender();
    expect(result.current).toBe(first);
  });
});
