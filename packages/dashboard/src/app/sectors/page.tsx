'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown,
  FlaskConical, Layers, Zap, Brain, Gamepad2,
  Building2, ImageIcon, Smile, DollarSign, Server, Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/LoadingSkeleton';

type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;

const SECTOR_ICON_MAP: Record<string, LucideIcon> = {
  'DeFi':           FlaskConical,
  'Layer 1':        Layers,
  'Layer 2':        Zap,
  'AI':             Brain,
  'Gaming':         Gamepad2,
  'RWA':            Building2,
  'NFT':            ImageIcon,
  'Meme':           Smile,
  'Stablecoin':     DollarSign,
  'Exchange':       BarChart3,
  'Infrastructure': Server,
  'Privacy':        Lock,
};

function colorForChange(pct: number) {
  if (pct > 10) return { bg: 'rgba(16,185,129,0.25)', border: '#10b981', text: '#10b981' };
  if (pct > 5) return { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' };
  if (pct > 0) return { bg: 'rgba(110,231,183,0.10)', border: '#6ee7b7', text: '#6ee7b7' };
  if (pct > -5) return { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fbbf24' };
  return { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' };
}

export default function SectorsPage() {
  const sectors = useQuery({
    queryKey: ['sectors'],
    queryFn: () => fetcher('/api/sectors'),
    refetchInterval: 120000,
  });

  const rawData: any = sectors.data;
  const list: any[] = (() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    const d = rawData.data ?? rawData;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.sector)) return d.sector;
    return [];
  })();

  // Normalize change values
  const normalized = list.map((s: any) => ({
    ...s,
    pct: (() => {
      const raw = Number(s.change_pct_24h ?? s.change_24h ?? 0);
      return Math.abs(raw) < 1 ? raw * 100 : raw;
    })(),
  })).sort((a, b) => b.pct - a.pct);

  const gainers = normalized.filter(s => s.pct > 0);
  const losers = normalized.filter(s => s.pct <= 0);

  return (
    <div>
      <PageHeader
        title="Sector Rotation"
        subtitle="Crypto sector momentum and capital flow analysis via SoSoValue"
      />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Top Gainer', val: gainers[0]?.name ?? '—', sub: gainers[0] ? `+${gainers[0].pct.toFixed(1)}%` : '', color: 'var(--green)' },
          { label: 'Sectors Tracked', val: String(normalized.length), sub: `${gainers.length} up · ${losers.length} down`, color: 'var(--blue)' },
          { label: 'Biggest Laggard', val: losers[losers.length - 1]?.name ?? '—', sub: losers.length ? `${losers[losers.length - 1].pct.toFixed(1)}%` : '', color: 'var(--red)' },
        ].map((c, i) => (
          <motion.div key={i} className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{c.val}</div>
            {c.sub && <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginTop: 3 }}>{c.sub}</div>}
          </motion.div>
        ))}
      </div>

      {/* Heatmap grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginBottom: 22 }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>24h Momentum Heatmap</h3>
        {sectors.isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)}
          </div>
        ) : normalized.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 50, color: 'var(--muted)' }}>
            <BarChart3 size={32} style={{ margin: '0 auto 10px', color: 'var(--muted)' }} />
            <p style={{ fontSize: 13 }}>Sector data not available. Backend /api/sectors may need SoSoValue key.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {normalized.map((s: any, i: number) => {
              const { bg, border, text } = colorForChange(s.pct);
              const SectorIcon = SECTOR_ICON_MAP[s.name] ?? TrendingUp;
              return (
                <motion.div
                  key={s.name ?? i}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                  whileHover={{ scale: 1.04, boxShadow: `0 4px 24px ${border}30` }}
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 14,
                    padding: '18px 14px',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <SectorIcon size={22} style={{ color: text }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.2 }}>
                    {s.name ?? `Sector ${i + 1}`}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: text, fontFamily: "'JetBrains Mono'" }}>
                    {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}%
                  </div>
                  {s.market_cap_usd != null && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      MCap ${(Number(s.market_cap_usd) / 1e9).toFixed(1)}B
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Ranking table */}
      {normalized.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Sector Ranking</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Sector', '24h Change', 'Market Cap', 'Trend'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0 10px 10px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalized.map((s: any, i: number) => {
                const { text } = colorForChange(s.pct);
                return (
                  <tr key={s.name ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', color: 'var(--muted)', fontWeight: 700, width: 32 }}>{i + 1}</td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {React.createElement(SECTOR_ICON_MAP[s.name] ?? TrendingUp, { size: 14, style: { color: 'var(--muted2)' } })}
                        {s.name}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span className="mono" style={{ color: text, fontWeight: 700 }}>
                        {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--muted2)' }} className="mono">
                      {s.market_cap_usd != null ? `$${(Number(s.market_cap_usd) / 1e9).toFixed(2)}B` : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {s.pct > 0
                        ? <TrendingUp size={14} style={{ color: 'var(--green)' }} />
                        : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
