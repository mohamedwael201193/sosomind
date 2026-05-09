'use client';

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, ShieldCheck, Activity, BarChart2 } from 'lucide-react';
import { StatCard } from '@/components/AnimatedNumber';
import { PageHeader, LoadingSkeleton } from '@/components/LoadingSkeleton';

const CHART_COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, fontWeight: 600, fontFamily: "'JetBrains Mono'" }}>
          ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
};

export default function PortfolioPage() {
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: () => fetcher('/api/portfolio'), refetchInterval: 60000 });
  const allocations = useQuery({ queryKey: ['allocations'], queryFn: () => fetcher('/api/portfolio/allocations'), refetchInterval: 60000 });
  const trades = useQuery({ queryKey: ['trades'], queryFn: () => fetcher('/api/portfolio/trades?limit=20'), refetchInterval: 60000 });
  const history = useQuery({ queryKey: ['portfolio-history'], queryFn: () => fetcher('/api/portfolio/history?limit=30'), refetchInterval: 120000 });

  const summary = (portfolio.data as any)?.summary || {};
  const positions: any[] = Array.isArray((portfolio.data as any)?.data) ? (portfolio.data as any).data : Array.isArray(portfolio.data) ? portfolio.data as any[] : [];
  const allocList: any[] = Array.isArray(allocations.data) ? allocations.data as any[] : [];
  const tradesList: any[] = Array.isArray(trades.data) ? trades.data as any[] : [];
  const histList: any[] = Array.isArray(history.data) ? (history.data as any[]).map((h: any) => ({
    date: new Date(h.snapshot_at || h.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    value: Number(h.total_value_usd),
  })) : [];

  const totalVal = Number(summary.totalValueUsd ?? 0);
  const totalPnl = Number(summary.totalPnlUsd ?? 0);
  const totalPnlPct = Number(summary.totalPnlPct ?? 0);
  const available = Number(summary.availableBalance ?? 0);

  return (
    <div>
      <PageHeader title="Portfolio" subtitle="Real-time positions, P&L and allocation via SoDEX" />

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Total Value" value={totalVal > 0 ? `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'} icon={<Wallet size={15} />} color="var(--green)" delay={0} />
        <StatCard label="24h P&L" value={totalPnl !== 0 ? `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'} trend={totalPnlPct} icon={totalPnl >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />} color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} delay={0.06} />
        <StatCard label="Available" value={available > 0 ? `$${available.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'} sub="Cash balance" icon={<ShieldCheck size={15} />} color="var(--blue)" delay={0.12} />
        <StatCard label="Positions" value={String(positions.length)} sub={`${tradesList.length} recent trades`} icon={<BarChart2 size={15} />} color="var(--purple)" delay={0.18} />
      </div>

      {/* PnL chart + allocation */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 18 }}>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Portfolio Value History</h3>
          {history.isLoading ? (
            <LoadingSkeleton rows={1} height={180} />
          ) : histList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--muted)', fontSize: 13 }}>
              No portfolio history yet. Make trades to track your value over time.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={histList}>
                <defs>
                  <linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `$${(Number(v)/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#pgr)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Allocation</h3>
          {allocList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, paddingTop: 40 }}>No positions to allocate</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={allocList} dataKey="value" nameKey="asset" outerRadius={60} innerRadius={35}>
                    {allocList.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allocList.slice(0, 4).map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], display: 'inline-block' }} />
                      {a.asset}
                    </span>
                    <span className="mono" style={{ color: 'var(--muted2)' }}>{Number(a.pct ?? 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Positions table */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Open Positions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Market', 'Side', 'Size', 'Entry', 'Mark', 'P&L', 'Risk'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p: any, i: number) => {
              const pnl = Number(p.pnl_usd ?? 0);
              return (
                <motion.tr
                  key={p.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <td style={{ padding: '10px 8px', fontWeight: 700 }}>{p.market}</td>
                  <td><span className={`badge ${p.side === 'long' || p.side === 'buy' ? 'badge-long' : 'badge-short'}`} style={{ padding: '2px 8px', fontSize: 10 }}>{(p.side || '').toUpperCase()}</span></td>
                  <td className="mono">{p.size}</td>
                  <td className="mono">${Number(p.entry_price).toLocaleString()}</td>
                  <td className="mono">${Number(p.mark_price ?? 0).toLocaleString()}</td>
                  <td className="mono" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td><span style={{ fontSize: 11, color: 'var(--muted2)' }}>{p.risk_level || '—'}</span></td>
                </motion.tr>
              );
            })}
            {positions.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '24px 8px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No open positions</td></tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Trade history */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Recent Trades</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Time', 'Market', 'Side', 'Amount', 'Price', 'Fee', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tradesList.map((t: any, i: number) => (
              <tr key={t.id ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 8px', color: 'var(--muted)', fontSize: 11 }}>{new Date(t.created_at).toLocaleString()}</td>
                <td style={{ fontWeight: 600 }}>{t.market}</td>
                <td><span className={`badge ${t.side === 'buy' || t.side === 'long' ? 'badge-long' : 'badge-short'}`} style={{ padding: '1px 6px', fontSize: 10 }}>{(t.side || '').toUpperCase()}</span></td>
                <td className="mono">{t.amount}</td>
                <td className="mono">${Number(t.price).toLocaleString()}</td>
                <td className="mono" style={{ color: 'var(--muted2)' }}>${Number(t.fee_usd ?? 0).toFixed(4)}</td>
                <td><span style={{ fontSize: 11, color: t.status === 'filled' ? 'var(--green)' : 'var(--muted2)' }}>{t.status}</span></td>
              </tr>
            ))}
            {tradesList.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '24px 8px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No trades recorded</td></tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
