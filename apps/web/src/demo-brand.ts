/**
 * The storefront's business identity. The MVP serves one provider (spec
 * section 3, no multi-tenant UI) and the API exposes no business endpoint,
 * so the name and tagline live here, matching `demo-data.ts`.
 */
export const BRAND = {
  name: 'Andes Data Studio',
  tagline: 'Dashboards, automations and data integrations for retail teams.',
  location: 'Santiago, Chile',
} as const;
