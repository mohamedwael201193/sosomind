"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher, fetchWithMeta } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { useWebSocket } from "@/lib/websocket";
import { TrendingUp, TrendingDown, Minus, Zap, Filter, Target, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { CryptoIcon } from "@/components/CryptoIcon";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Filter = "all" | "long" | "short" | "high-conf";

interface Signal {
  id?: string;
  symbol?: string;
  asset?: string;
  direction?: string;
  confidence?: number;
  reason?: string;
  reasoning?: string;
  entry?: number | null;
  entry_price?: number | null;
  takeProfit?: number | null;
  take_profit?: number | null;
  stopLoss?: number | null;
  stop_loss?: number | null;
  timestamp?: string | number;
  created_at?: string;
  status?: string;
  [key: string]: unknown;
}

export default function SignalsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { lastMessage } = useWebSocket("signals");

  const { data: signalsRaw, refetch } = useQuery({
    queryKey: ["signals-all"],
    queryFn: () => fetcher("/api/signals?limit=50"),
    refetchInterval: 30000,
  });

  const trackRecord = useQuery({
    queryKey: ["track-record"],
    queryFn: () => fetchWithMeta<any>("/api/signals/track-record"),
    refetchInterval: 300000,
  });

  const trData = (trackRecord.data as any)?.data ?? {};
  const hitRate = Number(trData.hit_rate ?? 0);
  const evaluated = Number(trData.evaluated_count ?? 0);
  const avgReturn = Number(trData.avg_return_pct ?? 0);

  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);

  // Handle live WebSocket signals
  if (lastMessage) {
    try {
      const msgData = lastMessage && typeof lastMessage === "object" ? (lastMessage as { data: unknown }).data : null;
      const parsed = (typeof msgData === "object" && msgData !== null ? msgData : {}) as Signal;
      if (parsed && parsed.symbol && !liveSignals.find((s) => s.id === parsed.id)) {
        setLiveSignals((prev) => [parsed, ...prev].slice(0, 10));
      }
    } catch {}
  }

  const allSignals: Signal[] = [
    ...liveSignals,
    ...(Array.isArray(signalsRaw) ? (signalsRaw as Signal[]) : []),
  ];

  const filteredSignals = allSignals.filter((s) => {
    const dir = (s.direction ?? "").toLowerCase();
    if (filter === "long") return dir === "long";
    if (filter === "short") return dir === "short";
    if (filter === "high-conf") return Number(s.confidence ?? 0) >= 75;
    return true;
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "long", label: "Long" },
    { key: "short", label: "Short" },
    { key: "high-conf", label: "High Confidence" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">AI Signals</h1>
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            {filteredSignals.length} signals · Real-time
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--green-soft)] text-[var(--green)] text-xs font-bold">
          <Zap className="w-3 h-3" />
          LIVE
        </div>
      </motion.div>

      {/* Track Record Banner */}
      {!trackRecord.isLoading && evaluated > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <GlassCard animate padding="md" glow={hitRate >= 0.6 ? "green" : hitRate >= 0.4 ? "none" : "red"}>
            <div className="flex items-center gap-3 flex-wrap">
              <Target className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Signal Track Record</span>
              <div className="flex items-center gap-6 flex-wrap ml-auto">
                <div className="text-center">
                  <motion.div
                    className={cn("text-xl font-black tabular-nums", hitRate >= 0.6 ? "text-[var(--green)]" : hitRate >= 0.4 ? "text-[var(--yellow)]" : "text-[var(--red)]")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {(hitRate * 100).toFixed(1)}%
                  </motion.div>
                  <div className="text-[10px] text-[var(--text-muted)]">Hit Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black tabular-nums text-[var(--text-primary)]">{evaluated}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Evaluated</div>
                </div>
                <div className="text-center">
                  <div className={cn("text-xl font-black tabular-nums", avgReturn >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                    {avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">Avg Return</div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Filter bar */}
      <GlassCard animate padding="sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all border",
                  filter === f.key
                    ? "bg-[rgba(59,130,246,0.15)] text-[var(--blue)] border-[rgba(59,130,246,0.3)]"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-hover)]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {filteredSignals.length} results
          </span>
        </div>
      </GlassCard>

      {/* Signals grid */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredSignals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-[var(--text-muted)]"
            >
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No signals match the current filter.</p>
            </motion.div>
          ) : (
            filteredSignals.map((signal, i) => {
              const dir = (signal.direction ?? "neutral").toLowerCase();
              const sym = signal.symbol ?? signal.asset ?? "?";
              const rawConf = Number(signal.confidence ?? 0);
              // Supabase may store 0-1 decimal; normalise to 0-100
              const conf = rawConf > 0 && rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);
              const entryPx = signal.entry ?? signal.entry_price ?? null;
              const tp = signal.takeProfit ?? signal.take_profit ?? null;
              const sl = signal.stopLoss ?? signal.stop_loss ?? null;
              const rationale = signal.reasoning ?? signal.reason ?? null;
              const ts = signal.timestamp ?? signal.created_at ?? null;
              const isLive = liveSignals.some((ls) => ls.id === signal.id);
              return (
                <motion.div
                  key={signal.id ?? `${sym}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ delay: i < 10 ? i * 0.03 : 0, duration: 0.3 }}
                >
                  <GlassCard
                    animate={false}
                    padding="md"
                    glow={dir === "long" ? "green" : dir === "short" ? "red" : "none"}
                    className={cn(isLive && "border-[var(--blue)]/40")}
                  >
                    <div className="flex items-start gap-4">
                      {/* Direction icon */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0",
                          dir === "long" && "bg-[var(--green-soft)]",
                          dir === "short" && "bg-[var(--red-soft)]",
                          dir === "neutral" && "bg-[var(--blue-soft)]"
                        )}
                      >
                        {dir === "long" ? (
                          <TrendingUp className="w-5 h-5 text-[var(--green)]" />
                        ) : dir === "short" ? (
                          <TrendingDown className="w-5 h-5 text-[var(--red)]" />
                        ) : (
                          <Minus className="w-5 h-5 text-[var(--blue)]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <CryptoIcon symbol={sym} size={22} />
                          <span className="text-base font-black text-[var(--text-primary)]">{sym}</span>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-bold",
                              dir === "long" && "bg-[var(--green-soft)] text-[var(--green)]",
                              dir === "short" && "bg-[var(--red-soft)] text-[var(--red)]",
                              dir === "neutral" && "bg-[var(--blue-soft)] text-[var(--blue)]"
                            )}
                          >
                            {dir.toUpperCase()}
                          </span>
                          {isLive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--blue-soft)] text-[var(--blue)]">
                              LIVE
                            </span>
                          )}
                          {signal.status && (
                            <span className="text-xs text-[var(--text-muted)]">{String(signal.status)}</span>
                          )}
                          {/* Outcome badge */}
                          {(signal as any).outcome === "HIT" && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--green-soft)] text-[var(--green)]">
                              <CheckCircle2 className="w-3 h-3" /> HIT
                            </span>
                          )}
                          {(signal as any).outcome === "STOP" && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--red-soft)] text-[var(--red)]">
                              <XCircle className="w-3 h-3" /> STOP
                            </span>
                          )}
                          {(signal as any).outcome === "DRIFT" && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[rgba(251,191,36,0.15)] text-[#fbbf24]">
                              DRIFT
                            </span>
                          )}
                        </div>

                        {rationale && (
                          <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-3">{String(rationale)}</p>
                        )}

                        {conf > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                              <span>Confidence</span>
                              <span className="font-semibold">{conf}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  dir === "long" ? "bg-[var(--green)]" : dir === "short" ? "bg-[var(--red)]" : "bg-[var(--blue)]"
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${conf}%` }}
                                transition={{ duration: 0.8, delay: i * 0.03 }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Entry / TP / SL price levels */}
                        {(entryPx || tp || sl) && (
                          <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                            {entryPx && (
                              <div>
                                <span className="text-[var(--text-muted)] block mb-0.5">Entry</span>
                                <span className="font-mono font-semibold text-[var(--text-secondary)]">${Number(entryPx).toLocaleString()}</span>
                              </div>
                            )}
                            {tp && (
                              <div>
                                <span className="text-[var(--text-muted)] block mb-0.5">Take Profit</span>
                                <span className="font-mono font-semibold text-[var(--green)]">${Number(tp).toLocaleString()}</span>
                              </div>
                            )}
                            {sl && (
                              <div>
                                <span className="text-[var(--text-muted)] block mb-0.5">Stop Loss</span>
                                <span className="font-mono font-semibold text-[var(--red)]">${Number(sl).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {ts && (
                          <div className="text-xs text-[var(--text-muted)]">
                            {new Date(
                              typeof ts === "string" ? ts : Number(ts) * (String(ts).length === 10 ? 1000 : 1)
                            ).toLocaleTimeString()}
                          </div>
                        )}
                        {signal.id && (
                          <Link
                            href={`/signals/${signal.id}`}
                            className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
                            style={{ color: "var(--accent, #3b82f6)" }}
                          >
                            Detail <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

