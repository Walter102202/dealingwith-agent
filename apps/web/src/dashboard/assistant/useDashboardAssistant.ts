import type { DashboardData } from '@dealingwith/contracts';
import { type AgAiHarnessSetup, AgStudioAiModule, type AgStudioModule } from 'ag-studio';
import type { AgAiToolDisplay } from 'ag-studio-react';
import { useEffect, useMemo, useRef } from 'react';
import { useAppConfig } from '../../api/config.js';
import { useSession } from '../../session.js';
import { assistantHarness } from './harness.js';
import { ASSISTANT_TOOL_DISPLAY } from './ReminderDetail.js';

/** Props spread onto `<AgStudio>`: empty when the assistant is off. */
export type AssistantStudioProps = {
  modules?: AgStudioModule[];
  ai?: AgAiHarnessSetup;
  aiToolDisplay?: Record<string, AgAiToolDisplay>;
};

const OFF: AssistantStudioProps = {};
const MODULES: AgStudioModule[] = [AgStudioAiModule];

/**
 * The AG Studio AI props when `/api/config` says the assistant is on, `{}` when
 * it is off, and `null` while the config is still loading: Studio resolves its
 * `ai` harness once, so it must mount with the final value.
 */
export function useDashboardAssistant(data: DashboardData | null): AssistantStudioProps | null {
  const config = useAppConfig();
  const { session } = useSession();
  const enabled = config.data?.assistant.enabled ?? (config.error ? false : null);
  const latest = useRef({ data, provider: session?.role === 'provider' ? session.name : null });
  useEffect(() => {
    latest.current = { data, provider: session?.role === 'provider' ? session.name : null };
  }, [data, session]);
  return useMemo(() => {
    if (enabled === null) return null;
    if (!enabled) return OFF;
    return {
      modules: MODULES,
      ai: assistantHarness({
        data: () => latest.current.data,
        providerName: () => latest.current.provider,
      }),
      aiToolDisplay: ASSISTANT_TOOL_DISPLAY,
    };
  }, [enabled]);
}
