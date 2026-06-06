'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher, fetchWithMeta } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown,
  FlaskConical, Layers, Zap, Brain, Gamepad2,
  Building2, ImageIcon, Smile, DollarSign, Server, Lock,
  ChevronUp,
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
  'Mag7 Stocks':    TrendingUp,
  'PayFi':          DollarSign,
  'CeFi':           Building2,
  'SocialFi':       Smile,
  'DePIN':          Server,
};

function colorForChange(pct: number) {
  if (pct > 10) return { bg: 'rgba(16,185,129,0.25)', border: '#10b981', text: '#10b981' };
  if (pct > 5) return { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' };
  if (pct > 0) return { bg: 'rgba(110,231,183,0.10)', border: '#6ee7b7', text: '#6ee7b7' };
  if (pct > -5) return { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fbbf24' };
  return { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' };
}

function verdictColor(verdict: string) {
  if (verdict === 'STRONG_BUY') return { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#10b981' };
  if (verdict === 'BUY') return { bg: 'rgba(52,211,153,0.12)', border: '#34d399', text: '#34d399' };
  if (verdict === 'NEUTRAL') return { bg: 'rgba(251,191,36,0.12)', border: '#fbbf24', text: '#fbbf24' };
  return { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444' };
}

// Animated score ring
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle
        cx={32} cy={32} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }}
      />
      <text
        x={32} y={37}
        fill={color}
        fontSize={13}
        fontWeight={800}
        textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fontFamily: 'monospace' }}
      >
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

// Mini signal bar
function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: 'monospace' }}>{value.toFixed(0)}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', borderRadius: 2, background: color }}
        />
      </div>
    </div>
  );
}

export default function SectorsPage() {
  const [activeTab, setActiveTab] = useState<'momentum' | 'intelligence'>('momentum');

  const sectors = useQuery({
    queryKey: ['sectors'],
    queryFn: () => fetcher('/api/sectors'),
    refetchInterval: 120000,
  });

  const intel = useQuery({
    queryKey: ['sectors-intel'],
    queryFn: () => fetchWithMeta<any[]>('/api/sectors/intel'),
    refetchInterval: 300000,
    enabled: activeTab === 'intelligence',
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

  const normalized = list.map((s: any) => ({
    ...s,
    momentum: Number(s.momentum ?? 50),
    pct: (() => {
      const raw = Number(s.change_pct_24h ?? s.change_24h ?? 0);
      return Math.abs(raw) < 1 && raw !== 0 ? raw * 100 : raw;
    })(),
  })).sort((a, b) => b.pct - a.pct);

  const allFlat24h = normalized.length > 0 && normalized.every((s) => s.pct === 0);
  const byMomentum = [...normalized].sort((a, b) => b.momentum - a.momentum);

  const gainers = allFlat24h ? byMomentum.filter(s => s.momentum >= 50) : normalized.filter(s => s.pct > 0);
  const losers = allFlat24h ? byMomentum.filter(s => s.momentum < 50) : normalized.filter(s => s.pct <= 0);

  const intelList: any[] = (() => {
    const d = intel.data;
    if (!d) return [];
    const arr = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
    return arr;
  })();

  const tabs = [
    { key: 'momentum', label: 'Momentum' },
    { key: 'intelligence', label: 'Intelligence' },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Sector Rotation"
        subtitle="Crypto sector momentum and capital flow analysis via SoSoValue"
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === t.key ? 'var(--accent, #3b82f6)' : 'transparent',
              color: activeTab === t.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.18s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'momentum' && (
          <motion.div key="momentum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                {
                  label: allFlat24h ? 'Top Momentum' : 'Top Gainer',
                  val: (allFlat24h ? byMomentum[0] : gainers[0])?.name ?? '—',
                  sub: allFlat24h
                    ? (byMomentum[0] ? `Score ${byMomentum[0].momentum}/100` : '')
                    : (gainers[0] ? `+${gainers[0].pct.toFixed(1)}%` : ''),
                  color: 'var(--green)',
                },
                { label: 'Sectors Tracked', val: String(normalized.length), sub: `${gainers.length} up · ${losers.length} down`, color: 'var(--blue)' },
                {
                  label: allFlat24h ? 'Lowest Momentum' : 'Biggest Laggard',
                  val: (allFlat24h ? byMomentum[byMomentum.length - 1] : losers[losers.length - 1])?.name ?? '—',
                  sub: allFlat24h
                    ? (byMomentum.length ? `Score ${byMomentum[byMomentum.length - 1].momentum}/100` : '')
                    : (losers.length ? `${losers[losers.length - 1].pct.toFixed(1)}%` : ''),
                  color: 'var(--red)',
                },
              ].map((c, i) => (
                <motion.div key={i} className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{c.val}</div>
                  {c.sub && <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginTop: 3 }}>{c.sub}</div>}
                </motion.div>
              ))}
            </div>

            {/* Heatmap grid */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                {allFlat24h ? 'SSI Momentum Heatmap' : '24h Momentum Heatmap'}
              </h3>
              {allFlat24h && (
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                  24h price feed flat from SoSoValue — showing composite SSI momentum scores (0–100).
                </p>
              )}
              {sectors.isLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)}
                </div>
              ) : normalized.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 50, color: 'var(--muted)' }}>
                  <BarChart3 size={32} style={{ margin: '0 auto 10px', color: 'var(--muted)' }} />
                  <p style={{ fontSize: 13 }}>Sector data not available.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {(allFlat24h ? byMomentum : normalized).map((s: any, i: number) => {
                    const heatVal = allFlat24h ? s.momentum - 50 : s.pct;
                    const { bg, border, text } = colorForChange(heatVal);
                    const SectorIcon = SECTOR_ICON_MAP[s.name] ?? TrendingUp;
                    return (
                      <motion.div
                        key={s.name ?? i}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.22 + i * 0.04 }}
                        whileHover={{ scale: 1.04, boxShadow: `0 4px 24px ${border}30` }}
                        style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '18px 14px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                      >
                        <div style={{ marginBottom: 6 }}><SectorIcon size={22} style={{ color: text }} /></div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.2 }}>{s.name ?? `Sector ${i + 1}`}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: text, fontFamily: "'JetBrains Mono'" }}>
                          {allFlat24h ? `${s.momentum}/100` : `${s.pct >= 0 ? '+' : ''}${s.pct.toFixed(1)}%`}
                        </div>
                        {s.market_cap_usd != null && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>MCap ${(Number(s.market_cap_usd) / 1e9).toFixed(1)}B</div>
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
                          <td style={{ padding: '10px' }}><span className="mono" style={{ color: text, fontWeight: 700 }}>{s.pct >= 0 ? '+' : ''}{s.pct.toFixed(2)}%</span></td>
                          <td style={{ padding: '10px', color: 'var(--muted2)' }} className="mono">{s.market_cap_usd != null ? `$${(Number(s.market_cap_usd) / 1e9).toFixed(2)}B` : '—'}</td>
                          <td style={{ padding: '10px' }}>{s.pct > 0 ? <TrendingUp size={14} style={{ color: 'var(--green)' }} /> : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'intelligence' && (
          <motion.div key="intelligence" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                Multi-signal intelligence scoring: Signal 1 (Fundraising) · Signal 2 (Sector Momentum) · Signal 3 (Sector Trend)
              </p>
            </div>

            {intel.isLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />)}
              </div>
            ) : intelList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <Brain size={36} style={{ margin: '0 auto 12px', color: 'var(--muted)' }} />
                <p style={{ fontSize: 13 }}>Intelligence engine warming up. Scores compute from live SoSoValue data.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {intelList.map((s: any, i: number) => {
                  const vc = verdictColor(s.verdict);
                  const SectorIcon = SECTOR_ICON_MAP[s.sector] ?? TrendingUp;
                  return (
                    <motion.div
                      key={s.ticker ?? i}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ scale: 1.02, boxShadow: `0 6px 30px ${vc.border}25` }}
                      className="card"
                      style={{ padding: '18px 16px', border: `1px solid ${vc.border}40`, position: 'relative', overflow: 'hidden' }}
                    >
                      {/* Glow bg */}
                      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: vc.bg, filter: 'blur(20px)', pointerEvents: 'none' }} />

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <SectorIcon size={16} style={{ color: vc.text }} />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{s.sector}</span>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: vc.bg, color: vc.text, fontWeight: 700, border: `1px solid ${vc.border}60` }}>
                          {s.verdict.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Score ring + ticker */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <ScoreRing score={Number(s.score ?? 0)} color={vc.text} />
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{s.ticker}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {s.topAssets?.slice(0, 3).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Signal bars */}
                      <SignalBar label="Signal 1 (Fundraising)" value={Number(s.s1 ?? 0)} color="rgba(59,130,246,0.8)" />
                      <SignalBar label="Signal 2 (Momentum)" value={Number(s.s2 ?? 0)} color="rgba(168,85,247,0.8)" />
                      <SignalBar label="Signal 3 (Trend)" value={Number(s.s3 ?? 0)} color={vc.text} />

                      {/* AI narrative */}
                      {s.aiNarrative && (
                        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
                          {String(s.aiNarrative).slice(0, 110)}{String(s.aiNarrative).length > 110 ? '…' : ''}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}