/**
 * The detail line under a KPI value: "2 quotes waiting for the client".
 * `null` when there is no count to show. `count` is the raw query value.
 */
export function countLine(
  count: unknown,
  formatted: string,
  words: { one?: string | undefined; many?: string | undefined },
): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  const noun = (count === 1 ? words.one : words.many)?.trim();
  return noun ? `${formatted} ${noun}` : formatted;
}
