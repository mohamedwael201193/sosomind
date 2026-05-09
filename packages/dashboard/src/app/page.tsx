"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { LiveTicker } from "@/components/LiveTicker";
import { MacroGauge } from "@/components/MacroGauge";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { SignalFeed } from "@/components/SignalFeed";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Zap, Globe2, BarChart3,
  Activity, ArrowRight, Send, Radio, Plus, ArrowUpDown,
  Bell, Search, ChevronDown, CreditCard, Layers,
} from "lucide-react";
import Link from "next/link";

// ── Time period tabs ──────────────────────────────────────────────────
const TIME_PERIODS = ['1D', '7D', '1M', '3M', '6M', 'Y', 'ALL'] as const;

function generateChartData(period: string) {
  const counts: Record<string, number> = { '1D': 24, '7D': 28, '1M': 30, '3M': 45, '6M': 50, 'Y': 52, 'ALL': 60 };
  const n = counts[period] ?? 30;
  const data: { time: string; value: number }[] = [];
  let value = 1_150_000 + Math.random() * 100_000;
  for (let i = 0; i < n; i++) {
    value = Math.max(900_000, value * (1 + (Math.random() - 0.46) * 0.025));
    const label = period === '1D' ? `${String(Math.floor(i)).padStart(2, '0')}:00` : `${i + 1}`;
    data.push({ time: label, value: Math.round(value) });
  }
  return data;
}

// ── Coin SVG icon ─────────────────────────────────────────────────────
const COIN_CFG: Record<string, { bg: string; text: string; symbol: string }> = {
  BTC:  { bg: '#f97316', text: '#fff', symbol: '₿' },
  ETH:  { bg: '#6366f1', text: '#fff', symbol: 'Ξ' },
  USDT: { bg: '#22c55e', text: '#fff', symbol: '₮' },
  SOL:  { bg: '#a855f7', text: '#fff', symbol: 'S' },
  BNB:  { bg: '#f59e0b', text: '#fff', symbol: 'B' },
};

function CoinIcon({ coin, size = 34 }: { coin: string; size?: number }) {
  const cfg = COIN_CFG[coin] ?? { bg: '#64748b', text: '#fff', symbol: coin[0] };
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: cfg.bg, color: cfg.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 800,
        boxShadow: `0 4px 12px ${cfg.bg}55`,
        flexShrink: 0, userSelect: 'none',
      }}
    >
      {cfg.symbol}
    </div>
  );
}

// ── Extej-style balance card ──────────────────────────────────────────
function BalanceCard({
  label, value, sub, pnl, pnlPct, coin, icon, color, children,
}: {
  label: string; value: string; sub?: string;
  pnl?: number; pnlPct?: number;
  coin?: string; icon?: React.ReactNode; color?: string;
  children?: React.ReactNode;
}) {
  const isPos = (pnl ?? 0) >= 0;
  const accentColor = color ?? 'var(--accent)';
  return (
    <GlassCard animate padding="md" spotlight hover>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {coin ? (
            <CoinIcon coin={coin} size={28} />
          ) : (
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `${accentColor}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: accentColor,
              }}
            >
              {icon}
            </div>
          )}
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <button
          className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-full"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-glass)' }}
        >
          USD <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div
        className="text-2xl font-black mb-1 tabular-nums"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      )}

      {pnl !== undefined && (
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Profit today
            {isPos ? (
              <TrendingUp className="inline w-3 h-3 ml-1" style={{ color: 'var(--green)' }} />
            ) : (
              <TrendingDown className="inline w-3 h-3 ml-1" style={{ color: 'var(--red)' }} />
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}
            >
              {isPos ? '+' : '-'}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            {pnlPct !== undefined && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                style={{
                  background: isPos ? 'var(--green-soft)' : 'var(--red-soft)',
                  color: isPos ? 'var(--green)' : 'var(--red)',
                }}
              >
                {isPos ? '+' : ''}{pnlPct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      {children}

      <div
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-40 rounded-b-[var(--radius-lg)]"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
    </GlassCard>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────
function ChartTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 10 }}>My Balance</div>
      <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
        ${payload[0].value.toLocaleString()}
      </div>
    </div>
  );
}

// ── Action pill button ────────────────────────────────────────────────
function ActionBtn({
  children, variant = 'ghost',
}: {
  children: React.ReactNode; variant?: 'orange' | 'ghost' | 'outline';
}) {
  const styles: Record<string, React.CSSProperties> = {
    orange:  { background: 'var(--grad-orange)', color: '#fff', boxShadow: '0 4px 12px rgba(249,115,22,0.30)' },
    ghost:   { background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' },
    outline: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' },
  };
  return (
    <button
      className="text-xs font-semibold px-4 py-1.5 rounded-full transition-all"
      style={{ ...styles[variant], cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

// ── Credit card mockup ────────────────────────────────────────────────
function CardMockup({ name, number, expiry, type, active }: {
  name: string; number: string; expiry: string; type: string; active?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative rounded-2xl p-5 overflow-hidden cursor-pointer"
      style={{
        background: active
          ? 'linear-gradient(135deg, #1a1e2e 0%, #252a3d 100%)'
          : 'linear-gradient(135deg, #111420 0%, #1a1e2e 100%)',
        border: active ? '1px solid rgba(249,115,22,0.30)' : '1px solid var(--glass-border)',
        minWidth: 200,
      }}
    >
      {active && (
        <div
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 8px rgba(249,115,22,0.4)' }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      {/* Mastercard circles */}
      <div className="flex mb-6">
        <div className="w-8 h-8 rounded-full opacity-90" style={{ background: '#eb001b', marginRight: -8 }} />
        <div className="w-8 h-8 rounded-full opacity-80" style={{ background: '#f79e1b' }} />
      </div>
      <div
        className="text-sm font-bold mb-3 tracking-widest"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}
      >
        {number}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{name}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{expiry}</div>
        </div>
        <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>{type}</div>
      </div>
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: active
            ? 'radial-gradient(ellipse at 80% 20%, rgba(249,115,22,0.08) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 60%)',
        }}
      />
    </motion.div>
  );
}

// ── Main dashboard page ───────────────────────────────────────────────
export default function DashboardPage() {
  const [nlpInput, setNlpInput] = useState("");
  const [nlpResult, setNlpResult] = useState<Record<string, unknown> | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [activePeriod, setActivePeriod] = useState<string>('1D');

  const chartData = useMemo(() => generateChartData(activePeriod), [activePeriod]);

  async function parseNlp() {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    setNlpResult(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";
      const res = await fetch(`${API_URL}/api/nlp/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpInput }),
      });
      const json = await res.json();
      setNlpResult(json.data ?? json);
    } catch {
      setNlpResult({ error: "NLP service unavailable" });
    } finally {
      setNlpLoading(false);
    }
  }

  const { data: macro } = useQuery({
    queryKey: ["macro"],
    queryFn: () => fetcher("/api/agents/macro"),
    refetchInterval: 120000,
  });
  const { data: sectorsRaw } = useQuery({
    queryKey: ["sectors"],
    queryFn: () => fetcher("/api/sectors"),
    refetchInterval: 120000,
  });
  const { data: signalsRaw } = useQuery({
    queryKey: ["signals-recent"],
    queryFn: () => fetcher("/api/signals?limit=8"),
    refetchInterval: 30000,
  });
  const { data: portfolioRaw } = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: () => fetcher("/api/portfolio"),
    refetchInterval: 60000,
  });
  const { data: fundingRaw } = useQuery({
    queryKey: ["funding-signals"],
    queryFn: () => fetcher("/api/signals/funding?limit=6"),
    refetchInterval: 30000,
  });

  const funding: Array<Record<string, unknown>> = (() => {
    const raw = fundingRaw as unknown;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    const d = (raw as Record<string, unknown>)?.data ?? raw;
    if (Array.isArray(d)) return d as Array<Record<string, unknown>>;
    return [];
  })();

  const macroData = (macro as Record<string, unknown>) ?? {};
  const macroScore = Number((macroData as { score?: unknown })?.score ?? 50);

  const sectors: Array<Record<string, unknown>> = (() => {
    const raw = sectorsRaw as unknown;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    const d = (raw as Record<string, unknown>)?.data ?? raw;
    if (Array.isArray(d)) return d as Array<Record<string, unknown>>;
    return [];
  })();

  const signals: Array<Record<string, unknown>> = Array.isArray(signalsRaw) ? signalsRaw as Array<Record<string, unknown>> : [];

  const portfolio = (portfolioRaw as Record<string, unknown>) ?? {};
  const summary = ((portfolio as { summary?: Record<string, unknown> })?.summary ?? portfolio) as Record<string, unknown>;
  const totalVal = Number(summary?.totalValueUsd ?? 0);
  const pnl = Number(summary?.totalPnlUsd ?? 0);
  const pnlPct = Number(summary?.totalPnlPct ?? 0);

  // ── Animation variants ──
  const containerV = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
  };
  const itemV = {
    hidden:  { opacity: 0, y: 28, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  };

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
              style={{
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              Live · Agentic OS
            </span>
          </div>
          <motion.h1
            className="font-black leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              letterSpacing: '-0.05em',
              color: 'var(--text-primary)',
            }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
            initial="hidden"
            animate="visible"
          >
            {'Dashboard'.split('').map((char, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={{
                  hidden:  { opacity: 0, y: 18, filter: 'blur(6px)' },
                  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </motion.span>
            ))}
          </motion.h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            SoSoValue · SoDEX · Multi-agent crypto intelligence
          </p>
        </motion.div>

        {/* Search + Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3"
        >
          <div
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', minWidth: 180 }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              placeholder="Search…"
              aria-label="Search dashboard"
              className="text-sm bg-transparent outline-none w-full"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
            />
          </div>
          <button
            aria-label="Notifications"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)' }}
          >
            <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 4px var(--accent)' }}
            />
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--grad-orange)', color: '#fff', boxShadow: '0 4px 12px rgba(249,115,22,0.30)' }}
            aria-label="User avatar"
          >
            A
          </div>
        </motion.div>
      </div>

      {/* Live Ticker */}
      <LiveTicker />

      {/* ── Balance Cards Row (Extej-style) ── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerV}
        initial="hidden"
        animate="visible"
      >
        {/* Balance Card */}
        <motion.div variants={itemV}>
          <BalanceCard
            label="Balance"
            value={totalVal > 0 ? `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$1,180,577'}
            sub={`${(summary?.positions as number) ?? 0} positions active`}
            pnl={pnl !== 0 ? pnl : 4245}
            pnlPct={pnlPct !== 0 ? pnlPct : 14.5}
            icon={<Wallet className="w-3.5 h-3.5" />}
            color="var(--accent)"
          >
            {/* Allocation bar */}
            <div className="mt-3">
              <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
                {[
                  { color: '#f97316', flex: 4 },
                  { color: '#6366f1', flex: 2.5 },
                  { color: '#22c55e', flex: 2 },
                  { color: '#64748b', flex: 1.5 },
                ].map(({ color, flex }, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ flex, background: color, transformOrigin: 'left', borderRadius: 4 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {[['BTC', '#f97316'], ['ETH', '#6366f1'], ['USDT', '#22c55e'], ['Other', '#64748b']].map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </BalanceCard>
        </motion.div>

        {/* BTC Card */}
        <motion.div variants={itemV}>
          <BalanceCard
            coin="BTC"
            label="Bitcoin"
            value="$213,017"
            sub="108.61 BTC  ·  1 BTC = $19,509"
            pnl={51237}
            pnlPct={5.0}
            color="#f97316"
          >
            <div className="flex gap-2 mt-3">
              <ActionBtn variant="orange">Swap</ActionBtn>
              <ActionBtn variant="ghost">Buy</ActionBtn>
              <ActionBtn variant="outline">Send</ActionBtn>
            </div>
          </BalanceCard>
        </motion.div>

        {/* ETH Card */}
        <motion.div variants={itemV}>
          <BalanceCard
            coin="ETH"
            label="Ethereum"
            value="$31,569"
            sub="107.45 ETH"
            pnl={-3337}
            pnlPct={-2.4}
            color="#6366f1"
          >
            <div className="flex gap-2 mt-3">
              <ActionBtn variant="ghost">Swap</ActionBtn>
              <ActionBtn variant="ghost">Buy</ActionBtn>
            </div>
          </BalanceCard>
        </motion.div>

        {/* Signals / Macro Card */}
        <motion.div variants={itemV}>
          <BalanceCard
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Signals"
            value={String(signals.filter(s => s.status === 'active' || s.status === 'pending').length || signals.length || 24)}
            sub="AI-generated · live"
            pnl={pnl !== 0 ? pnl : 2800}
            pnlPct={pnlPct !== 0 ? pnlPct : 3.2}
            color="var(--purple)"
          >
            <div className="flex items-center gap-2 mt-3">
              <div
                className="flex-1 flex items-center justify-between px-2 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--glass-border)' }}
              >
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Macro</span>
                <span
                  className="font-bold"
                  style={{
                    color: macroScore >= 66 ? 'var(--green)' : macroScore <= 33 ? 'var(--red)' : 'var(--orange)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {macroScore}
                </span>
              </div>
              <Globe2 className="w-4 h-4" style={{ color: macroScore >= 66 ? 'var(--green)' : macroScore <= 33 ? 'var(--red)' : 'var(--orange)' }} />
            </div>
          </BalanceCard>
        </motion.div>
      </motion.div>

      {/* ── My Wallets Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard padding="lg" animate={false}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2
                className="text-base font-bold"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
              >
                My Wallets
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Portfolio performance over time
              </p>
            </div>

            {/* Time period tabs */}
            <div
              className="flex items-center gap-0.5 rounded-full p-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
            >
              {TIME_PERIODS.map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all duration-200"
                  style={{
                    background: activePeriod === period ? 'var(--accent)' : 'transparent',
                    color: activePeriod === period ? '#fff' : 'var(--text-muted)',
                    boxShadow: activePeriod === period ? '0 2px 8px rgba(249,115,22,0.30)' : 'none',
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePeriod}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: 220 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="orangeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <RechartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: 'rgba(249,115,22,0.35)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#orangeAreaGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ── Main bento grid: left 2/3 + right 1/3 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Signal Feed + Sector Heatmap */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    className="text-base font-bold mb-0.5 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
                  >
                    <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    AI Signal Feed
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Real-time agent-generated signals
                  </p>
                </div>
                <Link
                  href="/signals"
                  className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2"
                  style={{ color: 'var(--accent)' }}
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <SignalFeed signals={signals} />
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    className="text-base font-bold mb-0.5 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
                  >
                    <Layers className="w-4 h-4" style={{ color: 'var(--blue)' }} />
                    Sector Momentum
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    24h sector rotation heat
                  </p>
                </div>
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
              <SectorHeatmap sectors={sectors as { name: string; change_pct_24h?: number; market_cap?: number }[]} />
            </GlassCard>
          </motion.div>
        </div>

        {/* Right column: Macro + Status */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard padding="md" animate={false} glow="orange">
              <div className="mb-4">
                <h2
                  className="text-base font-bold mb-0.5 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
                >
                  <Globe2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  Macro Regime
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Risk score · ETF + Events
                </p>
              </div>
              <MacroGauge score={macroScore} />
              {Array.isArray((macroData as { drivers?: unknown[] })?.drivers) && (
                <div className="mt-4 space-y-1.5">
                  {((macroData as { drivers: string[] }).drivers).slice(0, 3).map((d, i) => (
                    <div
                      key={i}
                      className="text-xs py-1.5 border-b last:border-0"
                      style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" style={{ color: 'var(--green)' }} />
                <h2
                  className="text-base font-bold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
                >
                  System Status
                </h2>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'SoSoValue API', status: 'online', color: 'var(--green)' },
                  { label: 'SoDEX Feed',    status: 'online', color: 'var(--green)' },
                  { label: 'AI Agents',     status: 'online', color: 'var(--green)' },
                  { label: 'WebSocket',     status: 'online', color: 'var(--green)' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: item.color }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: item.color }} />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* ── Funding Rate Signals ── */}
      {funding.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassCard padding="md" animate={false}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-base font-bold flex items-center gap-2 mb-0.5"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
                >
                  <Radio className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  Funding Rate Signals
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Extreme funding = mean reversion opportunity
                </p>
              </div>
              <Link
                href="/research"
                className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2"
                style={{ color: 'var(--accent)' }}
              >
                More <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {funding.slice(0, 6).map((f, i) => {
                const rate = Number(f.funding_rate ?? 0);
                const dir = String(f.signal ?? f.direction ?? 'neutral');
                const isLong = dir.includes('buy') || dir.includes('long');
                const isShort = dir.includes('sell') || dir.includes('short');
                const color = isLong ? 'var(--green)' : isShort ? 'var(--red)' : 'var(--text-muted)';
                return (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex items-center justify-between p-3 rounded-xl border cursor-default"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="font-bold text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {String(f.symbol ?? f.asset ?? '')}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>
                        {(rate * 100).toFixed(4)}%
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {dir.replace('_', ' ')}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── My Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard padding="md" animate={false}>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
            >
              <CreditCard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              My Cards
            </h2>
            <button
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
              style={{
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
              }}
            >
              <Plus className="w-3 h-3" /> ADD
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            <CardMockup
              name="JORDAN BELFORD"
              number="1111  2222  3333  4444"
              expiry="01/23"
              type="PERSONAL"
              active
            />
            <CardMockup
              name="MIKE"
              number="4444  3333  2222  1111"
              expiry="04/23"
              type="PERSO"
            />
            <CardMockup
              name="JASON BRAX"
              number="1111  2222  3333  4444"
              expiry="06/24"
              type="PERSONAL"
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* ── AI Trade Assistant ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard padding="md" animate={false}>
          <div className="mb-3">
            <h2
              className="text-base font-bold flex items-center gap-2 mb-0.5"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
            >
              <ArrowUpDown className="w-4 h-4" style={{ color: 'var(--purple)' }} />
              AI Trade Assistant
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Type a trade intent in natural language
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && parseNlp()}
              placeholder='e.g. "buy 0.1 BTC with 5x leverage" or "close ETH position"'
              className="flex-1 px-4 py-2.5 rounded-xl text-sm placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
            />
            <button
              onClick={parseNlp}
              disabled={nlpLoading || !nlpInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap transition-all"
              style={{
                background: 'var(--grad-orange)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(249,115,22,0.25)',
              }}
            >
              <Send className="w-3.5 h-3.5" />
              {nlpLoading ? 'Parsing…' : 'Parse'}
            </button>
          </div>
          {nlpResult && (
            <div
              className="mt-3 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}
            >
              {(nlpResult as { error?: string }).error ? (
                <span style={{ color: 'var(--red)' }}>{(nlpResult as { error: string }).error}</span>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(nlpResult as Record<string, unknown>)
                    .filter(([, v]) => v != null && v !== '')
                    .map(([k, v]) => (
                      <div key={k}>
                        <div className="font-semibold capitalize mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                          {k.replace(/_/g, ' ')}
                        </div>
                        <div className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </motion.div>

    </div>
  );
}

