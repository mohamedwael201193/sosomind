"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Scale, RefreshCw, TrendingUp, Info } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["var(--blue)", "var(--purple)", "var(--orange)", "var(--green)", "var(--red)", "#14b8a6", "#f472b6"];

const REGIME_COLORS: Record<string, string> = {
  risk_on: "var(--green)",
  risk_off: "var(--red)",
  neutral: "var(--orange)",
  unknown: "var(--text-muted)",
};

export default function RebalancePage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rebalance", address],
    queryFn: () => fetcher(`/api/rebalance?user_id=${address ?? 'anonymous'}`),
    refetchInterval: 120000,
  });

  const result = (data as any)?.data ?? data ?? {};
  const actions: any[] = Array.isArray(result.actions) ? result.actions : [];
  const currentAllocations: any[] = Array.isArray(result.current_allocations) ? result.current_allocations : [];
  const targetAllocations: any[] = Array.isArray(result.target_allocations) ? result.target_allocations : [];
  const regime = result.macro_regime ?? "unknown";

  const chartData = targetAllocations.map((t: any) => {
    const current = currentAllocations.find((c: any) => c.symbol === t.symbol);
    return {
      symbol: t.symbol,
      target: Number((t.pct * 100).toFixed(1)),
      current: Number(((current?.pct ?? 0) * 100).toFixed(1)),
    };
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Scale className="w-6 h-6 text-[var(--blue)]" /> Portfolio Rebalancer
            </h1>
            <p className="text-sm text-[var(--text-muted)]">AI-driven allocation recommendations based on macro regime &amp; persona</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: `${REGIME_COLORS[regime]}20` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: REGIME_COLORS[regime] }} />
              <span className="text-xs font-bold" style={{ color: REGIME_COLORS[regime] }}>{regime.replace("_", " ").toUpperCase()}</span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {isLoading && <div className="text-center py-8 text-[var(--text-muted)]">Generating rebalance recommendation…</div>}

      {!isLoading && chartData.length > 0 && (
        <GlassCard padding="md">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">Current vs Target Allocation</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="symbol" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: any) => [`${v}%`]}
              />
              <Bar dataKey="current" name="Current" radius={[4, 4, 0, 0]}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={`${COLORS[i % COLORS.length]}80`} />)}
              </Bar>
              <Bar dataKey="target" name="Target" radius={[4, 4, 0, 0]}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded opacity-50 bg-[var(--blue)]" /> Current</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--blue)]" /> Target</span>
          </div>
        </GlassCard>
      )}

      {actions.length > 0 && (
        <GlassCard padding="md">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">Recommended Actions</h2>
          <div className="space-y-3">
            {actions.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
                <div className="flex items-center gap-3">
                  <div
                    className="px-2 py-0.5 rounded-lg text-xs font-bold"
                    style={{ background: a.action === "buy" ? "var(--green)20" : "var(--red)20", color: a.action === "buy" ? "var(--green)" : "var(--red)" }}
                  >
                    {a.action?.toUpperCase()}
                  </div>
                  <span className="font-bold text-[var(--text-primary)]">{a.symbol}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {a.action === "buy" ? "+" : "-"}{(Number(a.delta_pct) * 100).toFixed(1)}%
                    {a.amount_usd ? ` (~$${Number(a.amount_usd).toFixed(0)})` : ""}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {(Number(a.current_pct) * 100).toFixed(1)}% → {(Number(a.target_pct) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {!isLoading && actions.length === 0 && chartData.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No portfolio data available</p>
            <p className="text-xs mt-1">Connect your wallet to get rebalance recommendations</p>
          </div>
        </GlassCard>
      )}

      {result.reasoning && (
        <GlassCard padding="md">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--blue)] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">AI Reasoning</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{result.reasoning}</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
