/**
 * The fixed demo ids of `apps/backend/src/db/demo-data.ts` (`id(n)`), copied
 * once so fixtures and tests reference the same records as the seed.
 */
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const DEMO_IDS = {
  business: id(1),
  S1: id(11),
  S2: id(12),
  S3: id(13),
  client: id(21),
  project: id(31),
  mandate: id(41),
} as const;

/** Ids minted by the fixtures for records the seed does not contain (quotes, requests, payments). */
export const fixtureId = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
