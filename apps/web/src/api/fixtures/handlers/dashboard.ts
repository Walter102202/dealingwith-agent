import type { DashboardData } from '@dealingwith/contracts';
import { dashboardRows } from '../dashboard-rows.js';
import { resetState, state } from '../state.js';

export const dashboardHandlers = {
  dashboardData(): DashboardData {
    return dashboardRows(state);
  },

  resetDemo(): { ok: true } {
    resetState();
    return { ok: true };
  },
};
