import type { Project, ProjectView, Service } from '@dealingwith/contracts';
import { SERVICES, state } from '../state.js';
import { activeAgents, notFound } from './shared.js';

export const catalogHandlers = {
  services(): Service[] {
    return SERVICES;
  },

  projects(): Project[] {
    return [state.project];
  },

  async getProject(id: string): Promise<ProjectView> {
    if (id !== state.project.id) throw notFound('Project');
    const service = SERVICES.find((s) => s.id === state.project.serviceId);
    if (!service) throw notFound('Service');
    const quotes = state.quotes
      .filter((q) => q.projectId === id)
      .slice()
      .reverse();
    const quoteIds = new Set(quotes.map((q) => q.id));
    return {
      project: structuredClone(state.project),
      service,
      quotes,
      payments: state.payments.filter((p) => quoteIds.has(p.quoteId)),
      mandate: state.mandate,
      agents: activeAgents(),
    };
  },
};
