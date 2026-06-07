"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import {
  AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Waves,
  Building2, BarChart2, Landmark, DollarSign, Filter,
} from "lucide-react";
import { CryptoIcon } from "@/components/CryptoIcon";
import { cn } from "@/lib/utils";

type Category = "all" | "etf_inflow" | "etf_outflow" | "treasury_buy" | "vc_funding" | "large_move";

interface WhaleAlert {
  id?: string;
  type: string;
  asset: string;
  amount_usd: number;
  entity: string;
  impact: "low" | "medium" | "high" | "critical";
  signal_direction: "bullish" | "bearish" | "neutral";
  reasoning: string;
  source: string;
  created_at?: string;
}

const IMPACT_COLOR = {
  critical: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  high:     { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  medium:   { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  low:      { bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/30" },
};

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  treasury_buy:  { icon: <Landmark className="w-5 h-5" />, label: "Treasury Buy",  color: "#10b981" },
  treasury_sell: { icon: <Landmark className="w-5 h-5" />, label: "Treasury Sell", color: "#ef4444" },
  etf_inflow:    { icon: <TrendingUp className="w-5 h-5" />, label: "ETF Inflow",    color: "#3b82f6" },
  etf_outflow:   { icon: <TrendingDown className="w-5 h-5" />, label: "ETF Outflow",   color: "#f97316" },
  vc_funding:    { icon: <Building2 className="w-5 h-5" />, label: "VC Funding",    color: "#8b5cf6" },
  large_move:    { icon: <BarChart2 className="w-5 h-5" />, label: "Large Move",    color: "#06b6d4" },
};

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

export default function WhalesPage() {
  const qc = useQueryClient();
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";
  const [category, setCategory] = useState<Category>("all");
  const [hasAutoScanned, setHasAutoScanned] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["whale-alerts"],
    queryFn: () => fetcher<WhaleAlert[]>("/api/whales"),
    refetchInterval: 120_000,
  });

  // fetcher auto-unwraps { data: [...] } → [...] directly
  const allAlerts: WhaleAlert[] = Array.isArray(data) ? data : [];

  const scan = useMutation({
    mutationFn: () =>
      fetch(`${API}/api/whales/scan`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whale-alerts"] }),
  });

  // Auto-scan once on first load if table is empty and backend is up
  useEffect(() => {
    if (!isLoading && allAlerts.length === 0 && !hasAutoScanned && !error) {
      setHasAutoScanned(true);
      scan.mutate();
    }
  }, [isLoading, allAlerts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = category === "all"
    ? allAlerts
    : allAlerts.filter((a) => a.type === category);

  // Summary stats
  const etfNetFlow = allAlerts
    .filter((a) => a.type === "etf_inflow" || a.type === "etf_outflow")
    .reduce((s, a) => s + (a.type === "etf_inflow" ? a.amount_usd : -a.amount_usd), 0);

  const treasuryTotal = allAlerts
    .filter((a) => a.type === "treasury_buy")
    .reduce((s, a) => s + a.amount_usd, 0);

  const vcTotal = allAlerts
    .filter((a) => a.type === "vc_funding")
    .reduce((s, a) => s + a.amount_usd, 0);

  const highImpactCount = allAlerts.filter((a) => a.impact === "high" || a.impact === "critical").length;
  const bullishCount = allAlerts.filter((a) => a.signal_direction === "bullish").length;
  const bearishCount = allAlerts.filter((a) => a.signal_direction === "bearish").length;

  const CATS: { key: Category; label: string }[] = [
    { key: "all",          label: "All" },
    { key: "etf_inflow",   label: "ETF Inflows" },
    { key: "etf_outflow",  label: "ETF Outflows" },
    { key: "treasury_buy", label: "Treasury Buys" },
    { key: "vc_funding",   label: "VC Funding" },
  ];

  return (
    <div className="space-y-6">
      <LabsPreviewBanner feature="Whale Tracker" />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
            <Waves className="w-6 h-6 text-[var(--blue)]" /> Whale Tracker
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Institutional flows: ETF net flows, treasury buys &amp; VC fundraising
          </p>
        </div>
        <button
          onClick={() => scan.mutate()}
          disabled={scan.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", scan.isPending && "animate-spin")} />
          Scan Now
        </button>
      </motion.div>

      {/* Summary stats */}
      {allAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            {
              label: "ETF Net Flow",
              value: formatUSD(Math.abs(etfNetFlow)),
              sub: etfNetFlow >= 0 ? "Net inflow" : "Net outflow",
              color: etfNetFlow >= 0 ? "#10b981" : "#ef4444",
              icon: etfNetFlow >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
            },
            {
              label: "Treasury Buys",
              value: formatUSD(treasuryTotal),
              sub: "Institutional BTC",
              color: "#8b5cf6",
              icon: <Landmark className="w-4 h-4" />,
            },
            {
              label: "VC Funding",
              value: formatUSD(vcTotal),
              sub: "Latest rounds",
              color: "#3b82f6",
              icon: <Building2 className="w-4 h-4" />,
            },
            {
              label: "Signal Split",
              value: `${bullishCount}B / ${bearishCount}Be`,
              sub: `${highImpactCount} high-impact`,
              color: bullishCount > bearishCount ? "#10b981" : "#ef4444",
              icon: <DollarSign className="w-4 h-4" />,
            },
          ].map((s) => (
            <GlassCard key={s.label} animate={false} padding="sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p className="text-xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.sub}</p>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* Category filter */}
      <GlassCard animate={false} padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                category === c.key
                  ? "bg-[rgba(59,130,246,0.15)] text-[var(--blue)] border-[rgba(59,130,246,0.3)]"
                  : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"
              )}
            >
              {c.label}
              {c.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({allAlerts.filter((a) => a.type === c.key).length})
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--text-muted)]">{filtered.length} alerts</span>
        </div>
      </GlassCard>

      {/* States */}
      {(isLoading || scan.isPending) && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">{scan.isPending ? "Scanning SoSoValue for whale movements..." : "Loading alerts..."}</span>
          </div>
        </GlassCard>
      )}

      {error && !isLoading && (
        <GlassCard padding="md">
          <div className="text-red-400 text-center text-sm py-4">
            Backend offline — start the server to fetch whale data.
          </div>
        </GlassCard>
      )}

      {!isLoading && !scan.isPending && filtered.length === 0 && !error && (
        <GlassCard padding="md">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <Waves className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-[var(--text-secondary)] mb-1">No whale alerts yet</p>
            <p className="text-xs mb-4">
              Whale data comes from SoSoValue: BTC ETF daily flows, treasury purchase history, and VC fundraising rounds.
            </p>
            <button
              onClick={() => scan.mutate()}
              className="px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              Scan Now
            </button>
          </div>
        </GlassCard>
      )}

      {/* Alert cards */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map((a, i) => {
            const meta = TYPE_META[a.type] ?? { icon: <AlertTriangle className="w-5 h-5" />, label: a.type, color: "var(--text-muted)" };
            const imp = IMPACT_COLOR[a.impact] ?? IMPACT_COLOR.low;
            const isBull = a.signal_direction === "bullish";
            const isBear = a.signal_direction === "bearish";
            return (
              <motion.div
                key={a.id ?? `${a.type}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: i < 8 ? i * 0.04 : 0, duration: 0.35 }}
              >
                <GlassCard
                  animate={false}
                  padding="md"
                  glow={isBull ? "green" : isBear ? "red" : "none"}
                >
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      {meta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <span className="font-black text-[var(--text-primary)] text-base flex items-center gap-1.5">
                          <CryptoIcon symbol={a.asset} size={20} />
                          {a.asset}
                        </span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${meta.color}18`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", imp.bg, imp.text, imp.border)}>
                          {a.impact.toUpperCase()}
                        </span>
                        {isBull && (
                          <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Bullish
                          </span>
                        )}
                        {isBear && (
                          <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Bearish
                          </span>
                        )}
                      </div>

                      {/* Amount + entity */}
                      <div className="text-sm font-bold text-[var(--text-primary)] mb-1">
                        <span className="font-mono text-[var(--blue)]">{formatUSD(Number(a.amount_usd))}</span>
                        {a.entity && a.entity !== "Unknown" && (
                          <span className="text-[var(--text-muted)] font-normal ml-2">&mdash; {a.entity}</span>
                        )}
                      </div>

                      {/* Reasoning */}
                      {a.reasoning && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{a.reasoning}</p>
                      )}

                      {/* Source */}
                      <p className="text-xs text-[var(--text-muted)] mt-2 opacity-60">
                        Source: {a.source?.replace(/_/g, " ")}
                      </p>
                    </div>

                    {/* Timestamp */}
                    {a.created_at && (
                      <div className="text-xs text-[var(--text-muted)] flex-shrink-0 text-right">
                        <div>{new Date(a.created_at).toLocaleDateString()}</div>
                        <div>{new Date(a.created_at).toLocaleTimeString()}</div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* How to use */}
      {allAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <GlassCard animate={false} padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">How to Use Whale Signals</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--text-secondary)]">
              <div className="space-y-1">
                <p className="font-bold text-[var(--blue)] flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> ETF Inflows</p>
                <p>Large ETF net inflows signal institutional accumulation. Historically precedes price appreciation. Consider increasing exposure during sustained inflow periods.</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold" style={{ color: "#8b5cf6" }}><Landmark className="w-3 h-3 inline mr-1" />Treasury Buys</p>
                <p>Corporate BTC purchases (MicroStrategy, Marathon, etc.) reduce circulating supply and signal long-term confidence. Strong bull signal when combined with ETF inflows.</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold" style={{ color: "#3b82f6" }}><Building2 className="w-3 h-3 inline mr-1" />VC Funding</p>
                <p>Large funding rounds in specific sectors (L2, DeFi, AI) signal where institutional capital is flowing. Watch the funded project&apos;s token for near-term catalysts.</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}