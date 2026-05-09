"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { ArrowLeftRight, TrendingUp, RefreshCw } from "lucide-react";

export default function ArbitragePage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["arbitrage"],
    queryFn: () => fetcher("/api/arbitrage"),
    refetchInterval: 15000,
  });

  const opps: any[] = Array.isArray((data as any)?.data) ? (data as any).data : [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-[var(--purple)]" /> Arbitrage Scanner
            </h1>
            <p className="text-sm text-[var(--text-muted)]">SoDEX vs Binance — real-time price discrepancies · updates every 15s</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--purple)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Header info row */}
      <div className="grid grid-cols-3 gap-4">
        {["SoDEX", "Binance", "Min Profit Threshold"].map((label, i) => (
          <GlassCard key={label} padding="sm">
            <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">{label}</div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {i === 0 ? "0.065% fee" : i === 1 ? "0.10% fee" : ">0.30% spread"}
            </div>
          </GlassCard>
        ))}
      </div>

      {isLoading && <div className="text-center py-12 text-[var(--text-muted)]">Scanning arbitrage opportunities…</div>}

      {!isLoading && opps.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-8 text-[var(--text-muted)]">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold mb-1">No profitable opportunities right now</p>
            <p className="text-xs">Markets are currently aligned. Check back in a few seconds.</p>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4">
        {opps.map((o: any, i: number) => {
          const profitColor = o.est_profit_pct >= 1 ? "var(--green)" : o.est_profit_pct >= 0.5 ? "var(--orange)" : "var(--text-primary)";
          const dir = o.direction === "buy_sodex_sell_binance" ? "Buy SoDEX → Sell Binance" : "Buy Binance → Sell SoDEX";
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard padding="md">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--purple)]20 flex items-center justify-center">
                      <span className="font-black text-sm text-[var(--purple)]">{o.asset}</span>
                    </div>
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{dir}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        SoDEX: ${Number(o.sodex_ask ?? o.sodex_bid ?? 0).toFixed(4)} |
                        Binance: ${Number(o.binance_ask ?? o.binance_bid ?? 0).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black" style={{ color: profitColor }}>
                      +{Number(o.est_profit_pct ?? 0).toFixed(3)}%
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Spread: {Number(o.spread_pct ?? 0).toFixed(3)}% | Conf: {o.confidence ?? "—"}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
