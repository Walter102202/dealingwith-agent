/**
 * An in-memory cap on assistant turns per UTC day (decision
 * 2026-11-10-assistant-daily-turn-cap). The hosted demo lets any visitor in as
 * the provider, so this bounds what a day of strangers can spend. One process,
 * so one counter; a restart resets it, which errs towards availability.
 */
export type DailyTurnCap = {
  readonly limit: number;
  /** Counts one turn; false once today's limit is reached. */
  take(): boolean;
};

export function createDailyTurnCap(limit: number, now: () => Date): DailyTurnCap {
  let day = '';
  let used = 0;
  return {
    limit,
    take() {
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}
