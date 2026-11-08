export function toIso(date: Date): string {
  return date.toISOString();
}
export function toIsoOrUndefined(date: Date | null): string | undefined {
  return date?.toISOString();
}
export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}
