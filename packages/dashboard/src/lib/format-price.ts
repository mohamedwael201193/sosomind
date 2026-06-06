/** Format USD prices — more decimals for sub-$1 assets (e.g. DOGE on testnet). */
export function formatUsdPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const maxFrac = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: maxFrac })}`;
}
