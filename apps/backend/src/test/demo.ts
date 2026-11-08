import type { ScopeClause, Service } from '@dealingwith/contracts';
import { DEMO } from '../db/demo-data.js';
export function demoServices(): Service[] {
  return structuredClone(
    Object.values(DEMO.services).map((service) => ({
      ...service,
      businessId: DEMO.business.id,
      inclusions: [...service.inclusions],
      exclusions: [...service.exclusions],
    })),
  );
}
export function demoClauses(): ScopeClause[] {
  return structuredClone([...DEMO.project.scopeClauses]);
}
export const DEMO_IDS = {
  business: DEMO.business.id,
  client: DEMO.client.id,
  project: DEMO.project.id,
  mandate: DEMO.mandate.id,
  S1: DEMO.services.S1.id,
  S2: DEMO.services.S2.id,
  S3: DEMO.services.S3.id,
};
