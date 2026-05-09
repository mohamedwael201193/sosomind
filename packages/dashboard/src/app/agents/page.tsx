'use client';

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Globe2, TrendingUp, TrendingDown, AlertTriangle, Calendar,
  BarChart2, Layers, RefreshCw, Activity,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { PageHeader, LoadingSkeleton } from '@/components/LoadingSkeleton';

// SVG Macro Gauge
function MacroGaugeLarge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score));
  const angle = -135 + (clamp / 100) * 270;
  const rad = (angle * Math.PI) / 180;
  const cx = 120, cy = 120, r = 90;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  const regime = clamp >= 60 ? { label: 'Risk-On', color: '#10b981', sub: 'Favorable for longs' }
    : clamp <= 40 ? { label: 'Risk-Off', color: '#ef4444', sub: 'Defensive positioning' }
    : { label: 'Neutral', color: '#f59e0b', sub: 'Mixed signals' };

  const arc = (startDeg: number, endDeg: number, color: string, width = 12) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 240 200" width={240} height={200}>
        {arc(-135, 135, '#1e293b', 12)}
        {arc(-135, -45, '#ef444450', 12)}
        {arc(-45, 45, '#f59e0b50', 12)}
        {arc(45, 135, '#10b98150', 12)}
        <motion.line
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={regime.color} strokeWidth={4} strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.16,1,0.3,1] }}
        />
        <circle cx={cx} cy={cy} r={7} fill={regime.color} style={{ filter: `drop-shadow(0 0 8px ${regime.color})` }} />
        <text x={cx} y={cy + 36} textAnchor="middle" fill={regime.color} fontSize="30" fontWeight="800" fontFamily="'JetBrains Mono'">{clamp}</text>
        <text x={cx} y={cy + 56} textAnchor="middle" fill={regime.color} fontSize="14" fontWeight="600">{regime.label}</text>
        <text x={cx} y={cy + 72} textAnchor="middle" fill="var(--muted)" fontSize="10">{regime.sub}</text>
        <text x={30} y={185} fill="#ef4444" fontSize="10">RISK-OFF</text>
        <text x={175} y={185} fill="#10b981" fontSize="10">RISK-ON</text>
      </svg>
    </div>
  );
}

const SCORE_COLORS: Record<string, string> = {
  etf_flow: '#3b82f6', fear_greed: '#8b5cf6', macro_events: '#f59e0b',
  correlation: '#10b981', volatility: '#ef4444', trend: '#06b6d4',
};

export default function MacroPage() {
  const macro = useQuery({ queryKey: ['macro'], queryFn: () => fetcher('/api/agents/macro'), refetchInterval: 120000 });
  const logs = useQuery({ queryKey: ['agent-logs'], queryFn: () => fetcher('/api/agent-logs?limit=30'), refetchInterval: 30000 });

  const md: any = (macro.data as any)?.data ?? macro.data ?? {};
  const score = Number(md.score ?? 50);
  const drivers: string[] = md.drivers ?? [];
  const breakdown: Record<string, number> = md.breakdown ?? {};
  const calendar: any[] = md.upcoming ?? md.events ?? [];
  const history: any[] = md.history ?? [];
  const logList: any[] = Array.isArray(logs.data) ? logs.data as any[] : [];

  const histChart = history.map((h: any) => ({
    date: new Date(h.snapshot_at || h.date || h.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    score: Number(h.score ?? 50),
  }));

  return (
    <div>
      <PageHeader title="Macro Regime" subtitle="Risk-on / risk-off scoring via ETF flows, macro events and on-chain signals" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Gauge */}
        <motion.div className="card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Regime Score</h3>
          {macro.isLoading ? <LoadingSkeleton rows={1} height={200} /> : <MacroGaugeLarge score={score} />}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Key Drivers</div>
            {drivers.slice(0, 4).map((d: string, i: number) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--muted2)', padding: '4px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                {d}
              </div>
            ))}
            {drivers.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No drivers. Run macro agent to populate.</div>}
          </div>
        </motion.div>

        {/* Score breakdown */}
        <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Score Breakdown</h3>
          {Object.keys(breakdown).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>No breakdown data. Backend returns full score only.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(breakdown).map(([key, val], i) => {
                const color = SCORE_COLORS[key] ?? 'var(--muted2)';
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--muted2)' }}>{key.replace(/_/g, ' ')}</span>
                      <span className="mono" style={{ color, fontWeight: 700 }}>{Number(val).toFixed(0)}</span>
                    </div>
                    <div className="conf-bar">
                      <motion.div className="conf-bar-fill" initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }} style={{ background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Correlation matrix placeholder */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>BTC–ETH–SOL Correlation</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', fontSize: 11 }}>
              {[['BTC', 'ETH', '0.92'], ['BTC', 'SOL', '0.85'], ['ETH', 'SOL', '0.88']].map(([a, b, v]) => (
                <div key={`${a}${b}`} style={{ background: 'var(--bg-elev)', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 9 }}>{a}/{b}</div>
                  <div className="mono" style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 16, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 30d history chart */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>30-Day Regime History</h3>
        {histChart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            No historical data. Regime snapshots accumulate over time.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={histChart}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={60} stroke="#10b98130" strokeDasharray="4 4" />
              <ReferenceLine y={40} stroke="#ef444430" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Economic calendar */}
      {calendar.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Upcoming Events</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              {['Date', 'Event', 'Impact'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0 10px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {calendar.map((e: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{e.date || e.time}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{e.event || e.title}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: e.impact === 'high' ? 'rgba(239,68,68,0.15)' : e.impact === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                      color: e.impact === 'high' ? 'var(--red)' : e.impact === 'medium' ? 'var(--orange)' : 'var(--muted2)',
                    }}>{e.impact || 'low'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Agent logs */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Agent Activity</h3>
        {logList.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>No agent activity logged yet.</div>
        ) : (
          logList.slice(0, 10).map((l: any, i: number) => (
            <div key={l.id ?? i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  fontWeight: 600,
                  color: l.level === 'error' ? 'var(--red)' : l.level === 'warn' ? 'var(--orange)' : 'var(--green)',
                }}>
                  [{l.agent}] {l.action}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleTimeString()} · {l.duration_ms}ms
                </span>
              </div>
              {l.error && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 2 }}>{l.error}</div>}
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
