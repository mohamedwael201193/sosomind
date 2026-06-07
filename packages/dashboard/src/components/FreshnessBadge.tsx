'use client';

import { cn } from '@/lib/utils';

export function getSignalFreshness(timestamp?: string | number | null): 'fresh' | 'aging' | 'stale' | 'unknown' {
  if (!timestamp) return 'unknown';
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (Number.isNaN(ms)) return 'unknown';
  const ageH = (Date.now() - ms) / 3_600_000;
  if (ageH < 1) return 'fresh';
  if (ageH < 24) return 'aging';
  return 'stale';
}

export function FreshnessBadge({ timestamp, className }: { timestamp?: string | number | null; className?: string }) {
  const level = getSignalFreshness(timestamp);
  const config = {
    fresh: { label: 'Fresh', color: 'var(--green)', bg: 'var(--green-soft)' },
    aging: { label: 'Aging', color: 'var(--orange)', bg: 'rgba(251,146,60,0.12)' },
    stale: { label: 'Stale', color: 'var(--text-muted)', bg: 'var(--glass-bg)' },
    unknown: { label: '—', color: 'var(--text-muted)', bg: 'var(--glass-bg)' },
  }[level];

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', className)}
      style={{ color: config.color, background: config.bg }}
    >
      {level !== 'unknown' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />}
      {config.label}
    </span>
  );
}
