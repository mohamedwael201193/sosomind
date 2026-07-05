"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { fetchWithMeta } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { CryptoIcon } from "@/components/CryptoIcon";
import {
  Target, TrendingUp, TrendingDown, Minus, ArrowRight,
  CheckCircle2, XCircle, Clock, ExternalLink, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUsdPrice } from "@/lib/format-price";

interface ResolvedSignal {
  id: string;
  asset: string;
  direction: string;
  confidence?: number;
  entry?: number;
  take_profit?: number;
  stop_loss?: number;
  outcome: string;
  outcome_price?: number;
  outcome_at?: string;
  created_at?: string;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = outcome?.toUpperCase();
  if (o === "HIT") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
        <CheckCircle2 className="w-3 h-3" /> HIT
      </span>
    );
  }
  if (o === "STOP") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
        <XCircle className="w-3 h-3" /> STOP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--glass-bg)", color: "var(--text-muted)" }}>
      <Minus className="w-3 h-3" /> DRIFT
    </span>
  );
}

export default function TrackRecordPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["track-record-full"],
    queryFn: () => fetchWithMeta<any>("/api/signals/track-record"),
    refetchInterval: 120_000,
  });

  const d = data?.data ?? {};
  const hitRate = d.hit_rate != null ? Number(d.hit_rate) : null;
  const hits = Number(d.hits ?? 0);
  const stops = Number(d.stops ?? 0);
  const drifts = Number(d.drifts ?? 0);
  const evaluated = Number(d.evaluated_count ?? hits + stops);
  const avgReturn = Number(d.avg_return_pct ?? 0);
  const total = Number(d.total_signals ?? 0);
  const recent: ResolvedSignal[] = Array.isArray(d.recent) ? d.recent : [];

  const stats = [
    { label: "Hit Rate", value: hitRate != null ? `${(hitRate * 100).toFixed(1)}%` : "—", icon: Target, accent: hitRate != null && hitRate >= 0.5 },
    { label: "HIT", value: String(hits), icon: CheckCircle2 },
    { label: "STOP", value: String(stops), icon: XCircle },
    { label: "DRIFT", value: String(drifts), icon: Minus },
    { label: "Avg Return", value: `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`, icon: TrendingUp },
    { label: "Total Signals", value: String(total), icon: Clock },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Signal Outcome Ledger</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Public HIT / STOP / DRIFT validation — live from Supabase, updated hourly
        </p>
      </motion.div>

      <GlassCard padding="md" glow="none">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--accent)]" />
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Outcomes are measured against live spot prices (Binance/CoinGecko). SoDEX testnet fill PnL may differ.
            <strong className="text-[var(--text-primary)]"> HIT</strong> = TP reached ·
            <strong className="text-[var(--text-primary)]"> STOP</strong> = SL hit ·
            <strong className="text-[var(--text-primary)]"> DRIFT</strong> = neither within 72h (not a loss).
            Hit rate = HIT ÷ (HIT + STOP) only. DRIFT excluded.
            Outcomes are measured against live spot prices. Execution PnL may differ from signal outcome.
            Not financial advice.{" "}
            <Link to="/methodology" className="underline text-[var(--accent)]">Methodology →</Link>
          </p>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <GlassCard padding="md">
          <p className="text-sm text-[var(--red)]">Could not load track record. Ensure backend is running.</p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard padding="md" glow={s.accent ? "green" : "none"}>
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-medium text-[var(--text-muted)]">{s.label}</span>
                  </div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Outcome distribution */}
          {evaluated > 0 && (
            <GlassCard padding="md" className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Outcome mix (resolved)</p>
              <div className="flex h-3 rounded-full overflow-hidden">
                {[
                  { n: hits, color: 'var(--green)' },
                  { n: stops, color: 'var(--red)' },
                  { n: drifts, color: 'var(--orange)' },
                ].map(({ n, color }, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${(n / Math.max(hits + stops + drifts, 1)) * 100}%`,
                      background: color,
                      minWidth: n > 0 ? 4 : 0,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-[var(--text-muted)]">
                <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--green)' }} />HIT {hits}</span>
                <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--red)' }} />STOP {stops}</span>
                <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--orange)' }} />DRIFT {drifts}</span>
              </div>
            </GlassCard>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Resolved Signals ({recent.length})
            </h2>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "var(--glass-bg)", color: "var(--accent)" }}
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {recent.length === 0 ? (
            <GlassCard padding="lg">
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                No resolved outcomes yet. Signals need 24h+ with TP/SL before evaluation.
                <br />
                <Link to="/research" className="text-[var(--accent)] underline mt-2 inline-block">
                  Run research to generate signals →
                </Link>
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {recent.map((sig, i) => (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                >
                  <Link to={`/signals/${sig.id}`}>
                    <GlassCard padding="md" className="hover:border-[var(--accent)] transition-colors cursor-pointer">
                      <div className="flex items-center gap-4 flex-wrap">
                        <CryptoIcon symbol={sig.asset} size={32} />
                        <div className="flex-1 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)]">{sig.asset}</span>
                            <span className={cn(
                              "text-xs font-bold uppercase",
                              sig.direction === "long" ? "text-[var(--green)]" : "text-[var(--red)]"
                            )}>
                              {sig.direction}
                            </span>
                            <OutcomeBadge outcome={sig.outcome} />
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Entry {formatUsdPrice(sig.entry)} · TP {formatUsdPrice(sig.take_profit)} · SL {formatUsdPrice(sig.stop_loss)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-[var(--text-muted)]">
                          {sig.outcome_at ? new Date(sig.outcome_at).toLocaleDateString() : "—"}
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          <GlassCard padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                <strong>{evaluated}</strong> decisive outcomes · Last updated{" "}
                {d.last_updated ? new Date(d.last_updated).toLocaleString() : "pending first evaluation"}
              </p>
              <Link
                to="/trade"
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Trade Latest Signal
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
