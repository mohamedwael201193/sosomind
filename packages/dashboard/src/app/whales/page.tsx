"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Waves } from "lucide-react";

export default function WhalesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["whale-alerts"],
    queryFn: () => fetcher("/api/whales"),
    refetchInterval: 60000,
  });
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";
  const scan = useMutation({
    mutationFn: () => fetch(`${API}/api/whales/scan`, { method: "POST" }).then(r => r.json()),

    onSuccess: () => qc.invalidateQueries({ queryKey: ["whale-alerts"] }),
  });

  const alerts: any[] = Array.isArray((data as any)?.data) ? (data as any).data : [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Waves className="w-6 h-6 text-[var(--blue)]" /> Whale Tracker
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Smart money movements from ETF flows, treasuries & fundraising</p>
          </div>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scan.isPending ? "animate-spin" : ""}`} /> Scan Now
          </button>
        </div>
      </motion.div>

      {isLoading && (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading whale alerts…</div>
      )}
      {error && (
        <GlassCard padding="md">
          <div className="text-red-400 text-center">Error loading whale alerts. Backend may be offline.</div>
        </GlassCard>
      )}

      {!isLoading && alerts.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Waves className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold mb-1">No whale alerts yet</p>
            <p className="text-xs">Click &ldquo;Scan Now&rdquo; to fetch the latest whale activity</p>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4">
        {alerts.map((a: any, i: number) => {
          const isBullish = a.signal_direction === "bullish";
          const isBearish = a.signal_direction === "bearish";
          const impactColor = a.impact === "high" ? "var(--red)" : a.impact === "medium" ? "var(--orange)" : "var(--text-muted)";
          return (
            <motion.div
              key={a.id ?? i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard padding="md">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isBullish ? "var(--green)20" : isBearish ? "var(--red)20" : "var(--surface-2)" }}
                  >
                    {isBullish ? (
                      <TrendingUp className="w-5 h-5" style={{ color: "var(--green)" }} />
                    ) : isBearish ? (
                      <TrendingDown className="w-5 h-5" style={{ color: "var(--red)" }} />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-[var(--text-primary)]">{a.asset}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] font-medium">{a.type}</span>
                      <span className="text-xs font-bold" style={{ color: impactColor }}>{a.impact?.toUpperCase()} IMPACT</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      ${(Number(a.amount_usd) / 1e6).toFixed(1)}M — {a.entity ?? "Unknown Entity"}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{a.reasoning}</p>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
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
