"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { ArrowLeftRight, RefreshCw, TrendingUp, Zap, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STRENGTH: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  low:    { label: "Low",    color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

function ConfidenceBadge({ v }: { v: string | number | undefined }) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  const color = n >= 0.7 ? "#10b981" : n >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full" style={{ color, background: color + "18" }}>
      {(n * 100).toFixed(0)}% conf
    </span>
  );
}

export default function ArbitragePage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["arbitrage"],
    queryFn: () => fetcher<any[]>("/api/arbitrage"),
    refetchInterval: 15_000,
  });

  // fetcher already unwraps { data: [...] }
  const opps: any[] = Array.isArray(data) ? data : [];
  const highCount = opps.filter((o) => Number(o.est_profit_pct) >= 0.8).length;
  const avgSpread = opps.length ? opps.reduce((s, o) => s + Number(o.spread_pct ?? 0), 0) / opps.length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6" style={{ color: "var(--purple)" }} /> Arbitrage Scanner
            </h1>
            <p className="text-sm text-[var(--text-muted)]">SoDEX vs Binance — real-time price discrepancies · updates every 15s</p>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: "var(--purple)" }}
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3">
        {[
          { label: "SoDEX Fee",          value: "0.065%", sub: "Maker/taker", color: "#8b5cf6" },
          { label: "Binance Fee",         value: "0.10%",  sub: "Maker/taker", color: "#f59e0b" },
          { label: "Min Profit Threshold", value: ">0.30%", sub: "After fees",  color: "#10b981" },
        ].map((s) => (
          <GlassCard key={s.label} animate={false} padding="sm">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-base font-black font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[var(--text-muted)]">{s.sub}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* Live summary */}
      {opps.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Opportunities Found", value: opps.length, color: "#8b5cf6", suffix: "" },
            { label: "High-Profit (≥0.8%)",  value: highCount,  color: "#10b981", suffix: "" },
            { label: "Avg Spread",            value: avgSpread.toFixed(3), color: "#f59e0b", suffix: "%" },
          ].map((s) => (
            <GlassCard key={s.label} animate={false} padding="sm">
              <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
              <p className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}{s.suffix}</p>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Scanning SoDEX and Binance order books…</span>
          </div>
        </GlassCard>
      )}

      {!isLoading && opps.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-[var(--text-secondary)] mb-1">No profitable opportunities right now</p>
            <p className="text-xs">Markets are currently aligned. Scanner runs every 15s automatically.</p>
          </div>
        </GlassCard>
      )}

      {/* Opportunity cards */}
      <div className="space-y-3">
        {opps.map((o: any, i: number) => {
          const pct = Number(o.est_profit_pct ?? 0);
          const profitColor = pct >= 1 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#8b5cf6";
          const direction = o.direction === "buy_sodex_sell_binance"
            ? { buy: "SoDEX", sell: "Binance" }
            : { buy: "Binance", sell: "SoDEX" };
          const strength = o.strength ?? (pct >= 0.8 ? "high" : pct >= 0.4 ? "medium" : "low");
          const s = STRENGTH[strength] ?? STRENGTH.low;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard animate={false} padding="md" glow={pct >= 0.8 ? "green" : pct >= 0.5 ? "none" : "none"}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm"
                      style={{ background: profitColor + "18", color: profitColor }}>
                      {o.asset ?? o.symbol ?? "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[var(--text-primary)] text-sm">Buy {direction.buy}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="font-bold text-[var(--text-primary)] text-sm">Sell {direction.sell}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                        <ConfidenceBadge v={o.confidence} />
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">
                        SoDEX ${Number(o.sodex_ask ?? o.sodex_bid ?? 0).toFixed(4)} &nbsp;|&nbsp; Binance ${Number(o.binance_ask ?? o.binance_bid ?? 0).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black font-mono" style={{ color: profitColor }}>
                      +{pct.toFixed(3)}%
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      Spread: {Number(o.spread_pct ?? 0).toFixed(3)}%
                      {o.volume_limit_usd && <span className="ml-2">Vol limit ${(Number(o.volume_limit_usd)/1000).toFixed(0)}K</span>}
                    </div>
                    {o.net_profit_usd != null && (
                      <div className="text-xs font-bold mt-0.5" style={{ color: profitColor }}>
                        ~${Number(o.net_profit_usd).toFixed(2)} net per trade
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: profitColor }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 50)}%` }}
                    transition={{ delay: 0.3 + i * 0.04, duration: 0.6, ease: [0.16,1,0.3,1] }}
                  />
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* How-to */}
      {opps.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <GlassCard animate={false} padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--purple)]" /> How to Execute Arbitrage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--text-secondary)]">
              <div><p className="font-bold text-[var(--purple)] mb-1">1. Identify the gap</p><p>Look for opportunities with ≥0.3% spread after SoDEX (0.065%) + Binance (0.10%) fees. High-confidence &gt;70% entries are safest.</p></div>
              <div><p className="font-bold text-[var(--purple)] mb-1">2. Execute fast</p><p>Use limit orders near the mid-price on both venues simultaneously. Spreads compress within seconds as bots react.</p></div>
              <div><p className="font-bold text-[var(--purple)] mb-1">3. Manage slippage</p><p>Check volume limit — large trades move the price. Keep position size within the shown limit to preserve the spread.</p></div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}