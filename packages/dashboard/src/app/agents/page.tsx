'use client';

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Calendar, RefreshCw, Activity, TrendingUp, TrendingDown,
  Minus, AlertCircle, CheckCircle, GitBranch,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { GlassCard } from '@/components/GlassCard';
import { cn } from '@/lib/utils';

// ─── Premium Gauge ────────────────────────────────────────────────────────────
function RegimeGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score));
  // Map score 0-100 → angle -135° to +135° (270° sweep)
  const angle = -135 + (clamp / 100) * 270;
  const rad = (angle * Math.PI) / 180;
  const cx = 130, cy = 130, r = 95;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  const regime =
    clamp >= 60 ? { label: 'Risk-On', color: '#10b981', sub: 'Favorable for longs', glow: '#10b98140' }
    : clamp <= 40 ? { label: 'Risk-Off', color: '#ef4444', sub: 'Defensive positioning', glow: '#ef444440' }
    : { label: 'Neutral', color: '#f59e0b', sub: 'Mixed signals', glow: '#f59e0b40' };

  const arc = (startDeg: number, endDeg: number, color: string, width = 14) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
      />
    );
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 260 220" width={260} height={220} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        {arc(-135, 135, 'rgba(255,255,255,0.06)', 14)}
        {/* Segment colors */}
        {arc(-135, -45, '#ef444428', 14)}
        {arc(-45, 45, '#f59e0b28', 14)}
        {arc(45, 135, '#10b98128', 14)}
        {/* Filled progress arc */}
        {clamp > 0 && arc(-135, -135 + (clamp / 100) * 270, regime.color + '80', 14)}
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((v) => {
          const a = ((-135 + (v / 100) * 270) * Math.PI) / 180;
          const ri = r - 10, ro = r + 6;
          return (
            <line key={v}
              x1={cx + ri * Math.cos(a)} y1={cy + ri * Math.sin(a)}
              x2={cx + ro * Math.cos(a)} y2={cy + ro * Math.sin(a)}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"
            />
          );
        })}
        {/* Needle */}
        <motion.g
          animate={{ rotate: angle + 90 }}
          style={{ originX: cx, originY: cy, transformOrigin: `${cx}px ${cy}px` }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy - r + 8}
            stroke={regime.color} strokeWidth={3} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${regime.color})` }}
          />
        </motion.g>
        {/* Centre pivot */}
        <circle cx={cx} cy={cy} r={9} fill={regime.color} style={{ filter: `drop-shadow(0 0 10px ${regime.color})` }} />
        <circle cx={cx} cy={cy} r={4} fill="var(--bg-base, #040406)" />
        {/* Score */}
        <text x={cx} y={cy + 36} textAnchor="middle" fill={regime.color}
          fontSize="34" fontWeight="900" fontFamily="'JetBrains Mono', monospace"
          style={{ filter: `drop-shadow(0 0 8px ${regime.color})` }}>
          {clamp}
        </text>
        <text x={cx} y={cy + 56} textAnchor="middle" fill={regime.color} fontSize="13" fontWeight="700">
          {regime.label}
        </text>
        <text x={cx} y={cy + 72} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">
          {regime.sub}
        </text>
        {/* Labels */}
        <text x={22} y={200} fill="#ef4444" fontSize="9" fontWeight="600">RISK-OFF</text>
        <text x={180} y={200} fill="#10b981" fontSize="9" fontWeight="600">RISK-ON</text>
      </svg>
    </div>
  );
}

// ─── Score breakdown bar ───────────────────────────────────────────────────────
const COMPONENT_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  etf_flow:     { label: 'ETF Flow',       color: '#3b82f6', icon: <TrendingUp className="w-3 h-3" /> },
  btc_momentum: { label: 'BTC Momentum',   color: '#8b5cf6', icon: <Activity className="w-3 h-3" /> },
  macro_risk:   { label: 'Macro Safety',   color: '#f59e0b', icon: <AlertCircle className="w-3 h-3" /> },
  sentiment:    { label: 'Sentiment',      color: '#10b981', icon: <CheckCircle className="w-3 h-3" /> },
};

const IMPACT_COLOR: Record<string, string> = {
  high: 'text-red-400 bg-red-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  low: 'text-slate-400 bg-slate-400/10',
};

export default function MacroPage() {
  const macro = useQuery({
    queryKey: ['macro'],
    queryFn: () => fetcher<any>('/api/agents/macro'),
    refetchInterval: 120_000,
  });

  const corr = useQuery({
    queryKey: ['correlation'],
    queryFn: () => fetcher<any>('/api/market/correlation'),
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const logs = useQuery({
    queryKey: ['agent-logs'],
    queryFn: () => fetcher<any>('/api/agent-logs?limit=30'),
    refetchInterval: 30_000,
  });

  const md: any = macro.data ?? {};
  const score = Number(md.score ?? 50);
  const drivers: string[] = Array.isArray(md.drivers) ? md.drivers : [];
  const breakdown: Record<string, number> = md.breakdown ?? {};
  const calendar: any[] = Array.isArray(md.upcomingEvents) ? md.upcomingEvents : [];
  const history: any[] = Array.isArray(md.history) ? md.history : [];
  const corrData: any = corr.data ?? {};
  const logList: any[] = Array.isArray(logs.data) ? logs.data : [];

  const histChart = history.map((h: any) => ({
    date: new Date(h.snapshot_at ?? h.date ?? h.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    score: Number(h.score ?? 50),
  }));

  const regime = score >= 60 ? 'risk-on' : score <= 40 ? 'risk-off' : 'neutral';
  const regimeColor = regime === 'risk-on' ? 'var(--green)' : regime === 'risk-off' ? 'var(--red)' : '#f59e0b';

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Macro Regime</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Risk-on / risk-off scoring via ETF flows, macro events and on-chain signals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              background: regime === 'risk-on' ? '#10b98118' : regime === 'risk-off' ? '#ef444418' : '#f59e0b18',
              color: regimeColor,
              border: `1px solid ${regimeColor}40`,
            }}
          >
            {regime.replace('-', ' ')}
          </span>
          {macro.isFetching && <RefreshCw className="w-4 h-4 text-[var(--text-muted)] animate-spin" />}
        </div>
      </motion.div>

      {/* Top row: Gauge + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gauge card */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <GlassCard padding="md" glow={regime === 'risk-on' ? 'green' : regime === 'risk-off' ? 'red' : 'none'}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Regime Score</h3>
            {macro.isLoading ? (
              <div className="h-52 flex items-center justify-center text-[var(--text-muted)] text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading macro data...
              </div>
            ) : (
              <RegimeGauge score={score} />
            )}
            {/* Key drivers */}
            {drivers.length > 0 && (
              <div className="border-t border-[var(--border-subtle)] mt-3 pt-3 space-y-2">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Key Drivers</p>
                {drivers.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: regimeColor }} />
                    {d}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Breakdown + correlation */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="space-y-4"
        >
          <GlassCard padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Score Breakdown</h3>
            {Object.keys(breakdown).length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {macro.isLoading ? 'Loading...' : 'No breakdown available. Run macro agent.'}
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(breakdown).map(([key, val], i) => {
                  const meta = COMPONENT_META[key] ?? { label: key.replace(/_/g, ' '), color: 'var(--text-muted)', icon: null };
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1.5 text-[var(--text-secondary)] capitalize font-medium">
                          <span style={{ color: meta.color }}>{meta.icon}</span>
                          {meta.label}
                        </span>
                        <span className="font-bold font-mono" style={{ color: meta.color }}>
                          {Number(val).toFixed(0)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: meta.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${val}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Correlation matrix */}
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
                Asset Correlation (30d)
              </h3>
              {corrData.updated_at && (
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(corrData.updated_at).toLocaleTimeString()}
                </span>
              )}
            </div>
            {corr.isLoading ? (
              <p className="text-xs text-[var(--text-muted)]">Computing correlations...</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['BTC', 'ETH', corrData.BTC_ETH],
                    ['BTC', 'SOL', corrData.BTC_SOL],
                    ['ETH', 'SOL', corrData.ETH_SOL],
                  ] as [string, string, number | undefined][]
                ).map(([a, b, v]) => {
                  const val = v ?? null;
                  const color = val !== null
                    ? val > 0.8 ? '#10b981' : val > 0.5 ? '#f59e0b' : '#ef4444'
                    : 'var(--text-muted)';
                  return (
                    <div
                      key={`${a}${b}`}
                      className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-xs text-[var(--text-muted)] mb-1">{a}/{b}</p>
                      <p className="text-xl font-black font-mono" style={{ color }}>
                        {val !== null ? val.toFixed(2) : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* 30-Day history chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <GlassCard padding="md">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">30-Day Regime History</h3>
          {histChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
              <Activity className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No historical data yet. Regime snapshots accumulate over time.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={histChart}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'rgba(13,13,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v: any) => [`${v}`, 'Score']}
                />
                <ReferenceLine y={60} stroke="#10b98130" strokeDasharray="4 4" label={{ value: 'Risk-On', fill: '#10b98150', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={40} stroke="#ef444430" strokeDasharray="4 4" label={{ value: 'Risk-Off', fill: '#ef444450', fontSize: 9, position: 'right' }} />
                <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#scoreGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </motion.div>

      {/* Economic calendar */}
      {calendar.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" /> Upcoming Events
            </h3>
            <div className="space-y-2">
              {calendar.map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-[var(--border-subtle)] last:border-0 text-sm">
                  <span className="text-xs text-[var(--text-muted)] w-24 flex-shrink-0 font-mono">
                    {e.date ? new Date(e.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                  <span className="flex-1 font-semibold text-[var(--text-primary)]">{e.name ?? e.event ?? '—'}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', IMPACT_COLOR[e.importance ?? 'low'] ?? IMPACT_COLOR.low)}>
                    {(e.importance ?? 'low').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Agent activity */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard padding="md">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--text-muted)]" /> Agent Activity
          </h3>
          {logList.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No agent activity logged yet.</p>
          ) : (
            <div className="space-y-0">
              {logList.slice(0, 12).map((l: any, i: number) => {
                const lvl = l.level ?? 'info';
                const c = lvl === 'error' ? 'var(--red)' : lvl === 'warn' ? '#f59e0b' : 'var(--green)';
                return (
                  <div
                    key={l.id ?? i}
                    className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0 text-xs"
                  >
                    <span className="font-mono font-semibold" style={{ color: c }}>
                      [{l.agent}] {l.action}
                    </span>
                    <div className="flex items-center gap-3 text-[var(--text-muted)] flex-shrink-0">
                      {l.duration_ms != null && (
                        <span className="font-mono">{l.duration_ms}ms</span>
                      )}
                      <span>{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}