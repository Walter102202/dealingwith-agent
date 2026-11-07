export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents))
    throw new RangeError('Amount must be an integer number of cents');
  return `US$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
