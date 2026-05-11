"use client";
import { motion } from "framer-motion";
import { Database, Zap, Clock, AlertTriangle } from "lucide-react";

export interface CacheMeta {
  cachedAt?: string;
  ageMs?: number;
  isStale?: boolean;
  source?: 'live' | 'cache' | 'fallback' | 'computed' | string;
  ttlMs?: number;
}

function ageLabel(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  meta?: CacheMeta | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function CacheBadge({ meta, size = 'sm', className }: Props) {
  if (!meta) return null;
  const stale = !!meta.isStale;
  const fallback = meta.source === 'fallback';
  const live = !stale && !fallback;

  const Icon = stale ? AlertTriangle : fallback ? Clock : meta.source === 'cache' ? Database : Zap;
  const tint = stale
    ? 'rgb(255,170,40)'
    : fallback
    ? 'rgb(180,180,200)'
    : meta.source === 'cache'
    ? 'rgb(120,180,255)'
    : 'rgb(80,220,160)';

  const label = stale
    ? `Stale · ${ageLabel(meta.ageMs)}`
    : fallback
    ? `Fallback · ${ageLabel(meta.ageMs)}`
    : meta.source === 'cache'
    ? `Cached · ${ageLabel(meta.ageMs)}`
    : meta.source === 'computed'
    ? `Computed · ${ageLabel(meta.ageMs)}`
    : `Live · ${ageLabel(meta.ageMs)}`;

  const px = size === 'sm' ? '6px 8px' : '8px 12px';
  const fs = size === 'sm' ? 10 : 11;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      title={meta.cachedAt ? `Fetched ${meta.cachedAt} · ttl ${Math.round((meta.ttlMs ?? 0) / 1000)}s` : ''}
      className={`inline-flex items-center gap-1.5 rounded-full border ${className ?? ''}`}
      style={{
        padding: px,
        fontSize: fs,
        lineHeight: 1,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: tint,
        borderColor: `color-mix(in srgb, ${tint} 35%, transparent)`,
        background: `color-mix(in srgb, ${tint} 8%, transparent)`,
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%', background: tint,
          boxShadow: live ? `0 0 8px ${tint}` : 'none',
          animation: live ? 'pulse 2.4s ease-in-out infinite' : undefined,
        }}
      />
      <Icon style={{ width: fs + 2, height: fs + 2 }} />
      {label}
      <style jsx>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </motion.span>
  );
}
