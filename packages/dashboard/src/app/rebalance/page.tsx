"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { PieChart, RefreshCw, TrendingUp, TrendingDown, Minus, Target, Activity } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  risk_on:      { label: "Risk-On",      color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  risk_off:     { label: "Risk-Off",     color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  neutral:      { label: "Neutral",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  accumulation: { label: "Accumulation", color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
  distribution: { label: "Distribution", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  bear:         { label: "Bear Market",  color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  bull:         { label: "Bull Market",  color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
};

const ASSET_COLORS = ["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#f97316"];

function AllocationBar({ label, pct, target, color }: { label: string; pct: number; target: number; color: string }) {
  const diff = pct - target;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[var(--text-primary)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Target {target.toFixed(1)}%</span>
          <span className="font-mono font-black" style={{ color }}>{pct.toFixed(1)}%</span>
          {Math.abs(diff) >= 0.5 && (
            <span className={cn("text-xs font-mono", diff > 0 ? "text-orange-400" : "text-blue-400")}>
              {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-white/5">
        <motion.div className="absolute top-0 left-0 h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.7, ease: [0.16,1,0.3,1] }} />
        <div className="absolute top-0 h-full w-0.5 bg-white/30 rounded-full" style={{ left: `${Math.min(100, target)}%` }} />
      </div>
    </div>
  );
}

export default function RebalancePage() {
  const { address } = useWallet();
  const USER = address ?? "anonymous";
  const [portfolioValue, setPortfolioValue] = useState(10000);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rebalance", USER, portfolioValue],
    queryFn: () => fetcher<any>(`/api/rebalance?user_id=${USER}&portfolio_value=${portfolioValue}`),
    refetchInterval: 60_000,
  });

  // fetcher auto-unwraps { data: result } → result which is the object
  const result: any = data ?? {};
  const actions: any[]            = Array.isArray(result.actions)             ? result.actions             : [];
  const currentAllocations: any[] = Array.isArray(result.current_allocations) ? result.current_allocations : [];
  const targetAllocations: any[]  = Array.isArray(result.target_allocations)  ? result.target_allocations  : [];
  const regime = result.macro_regime ?? result.regime ?? "neutral";
  const rc = REGIME_CONFIG[regime] ?? REGIME_CONFIG.neutral;

  const buyActions  = actions.filter((a) => a.action === "buy"  || a.direction === "buy"  || Number(a.delta_pct ?? a.delta ?? 0) > 0);
  const sellActions = actions.filter((a) => a.action === "sell" || a.direction === "sell" || Number(a.delta_pct ?? a.delta ?? 0) < 0);

  const totalRebalanceUsd = actions.reduce((s: number, a: any) => s + Math.abs(Number(a.usd_amount ?? a.amount_usd ?? 0)), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Target className="w-6 h-6 text-[var(--blue)]" /> Portfolio Rebalancer
            </h1>
            <p className="text-sm text-[var(--text-muted)]">AI-driven allocation recommendations based on current macro regime</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-[var(--text-muted)]">Portfolio $</span>
              <input
                type="number" value={portfolioValue}
                onChange={(e) => setPortfolioValue(Number(e.target.value))}
                className="w-24 bg-transparent text-sm font-mono text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--blue)" }}>
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /> Update
            </button>
          </div>
        </div>
      </motion.div>

      {/* Regime + stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard animate={false} padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">Macro Regime</p>
          <span className="text-sm font-black px-3 py-1 rounded-full inline-block" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
        </GlassCard>
        <GlassCard animate={false} padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">Actions Required</p>
          <p className="text-2xl font-black font-mono" style={{ color: actions.length > 0 ? "#f59e0b" : "#10b981" }}>{actions.length}</p>
        </GlassCard>
        <GlassCard animate={false} padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">To Buy</p>
          <p className="text-2xl font-black font-mono text-green-400">{buyActions.length}</p>
        </GlassCard>
        <GlassCard animate={false} padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">To Sell</p>
          <p className="text-2xl font-black font-mono text-red-400">{sellActions.length}</p>
        </GlassCard>
      </motion.div>

      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Generating rebalance recommendations…</span>
          </div>
        </GlassCard>
      )}

      {!isLoading && actions.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-[var(--text-secondary)] mb-1">Portfolio is balanced</p>
            <p className="text-xs">Your current allocations match the target for the <span style={{ color: rc.color }}>{rc.label}</span> regime.</p>
          </div>
        </GlassCard>
      )}

      {/* Rebalance actions */}
      {actions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <GlassCard animate={false} padding="md" glow="blue">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--blue)]" /> Rebalance Actions
              </h3>
              {totalRebalanceUsd > 0 && (
                <span className="text-xs text-[var(--text-muted)] font-mono">Total movement ~${totalRebalanceUsd.toFixed(0)}</span>
              )}
            </div>
            <div className="space-y-2">
              {actions.map((a: any, i: number) => {
                const isBuy = a.action === "buy" || a.direction === "buy" || Number(a.delta_pct ?? a.delta ?? 0) > 0;
                const delta = Number(a.delta_pct ?? a.delta ?? 0);
                const usd = Number(a.usd_amount ?? a.amount_usd ?? 0);
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                    className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 gap-3">
                    <div className="flex items-center gap-2">
                      {isBuy
                        ? <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                        : <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <span className={cn("text-xs font-black px-2 py-0.5 rounded-full", isBuy ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="font-bold text-sm text-[var(--text-primary)]">{a.symbol ?? a.asset}</span>
                    </div>
                    <div className="text-right text-xs font-mono flex-shrink-0">
                      {usd !== 0 && <span className={cn("font-black", isBuy ? "text-green-400" : "text-red-400")}>{isBuy ? "+" : "-"}${Math.abs(usd).toFixed(0)}</span>}
                      {delta !== 0 && <span className="text-[var(--text-muted)] ml-2">{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</span>}
                      {a.reason && <p className="text-[var(--text-muted)] text-right mt-0.5">{a.reason}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Allocation comparison */}
      {(currentAllocations.length > 0 || targetAllocations.length > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <GlassCard animate={false} padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[var(--blue)]" /> Current vs Target Allocation
              <span className="text-xs text-[var(--text-muted)] font-normal ml-1">— dashed = target</span>
            </h3>
            <div className="space-y-3">
              {(currentAllocations.length > 0 ? currentAllocations : targetAllocations).map((a: any, i: number) => {
                const symbol = a.symbol ?? a.asset ?? `Asset ${i}`;
                const cur = Number(a.pct ?? a.current_pct ?? a.allocation ?? 0);
                const tgt = (targetAllocations.find((t: any) => (t.symbol ?? t.asset) === symbol) ?? {}).pct ?? cur;
                return (
                  <AllocationBar key={symbol} label={symbol} pct={cur} target={tgt} color={ASSET_COLORS[i % ASSET_COLORS.length]} />
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}