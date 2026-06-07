"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { LiveTicker } from "@/components/LiveTicker";
import { MacroGauge } from "@/components/MacroGauge";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { SignalFeed } from "@/components/SignalFeed";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Wallet, Zap, Globe2, BarChart3,
  Activity, ArrowRight, Send, Radio, ArrowUpDown,
  Bell, Search, Layers, ExternalLink, Target, CandlestickChart,
} from "lucide-react";
import { SetupProgress } from "@/components/SetupProgress";
import { useSetupProgress } from "@/hooks/useSetupProgress";
import { startJudgePath } from "@/components/JudgePathBanner";
import { fetchWithMeta } from "@/lib/api";

// -- Stat Card
function StatCard({
  icon, label, value, sub, color, pnl, pnlPct, empty, href,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color?: string; pnl?: number; pnlPct?: number; empty?: string; href?: string;
}) {
  const isPos = (pnl ?? 0) >= 0;
  const accent = color ?? "var(--accent)";
  const inner = (
    <GlassCard animate padding="md" spotlight hover>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}22`, color: accent }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
      </div>
      {empty ? (
        <div className="py-2">
          <div className="text-sm mb-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {empty}
          </div>
          {href && (
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: accent }}>
              Set up <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </div>
      ) : (
        <>
          <div
            className="text-2xl font-black tabular-nums mb-1"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
          >
            {value}
          </div>
          {sub && (
            <div className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {sub}
            </div>
          )}
          {pnl !== undefined && (
            <div
              className="flex items-center gap-1.5 mt-3 pt-2.5 border-t text-xs"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {isPos ? (
                <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color: "var(--green)" }} />
              ) : (
                <TrendingDown className="w-3 h-3 flex-shrink-0" style={{ color: "var(--red)" }} />
              )}
              <span
                className="font-bold"
                style={{ color: isPos ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)" }}
              >
                {isPos ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {pnlPct !== undefined && ` (${isPos ? "+" : ""}${pnlPct.toFixed(1)}%)`}
              </span>
              <span style={{ color: "var(--text-muted)" }}>today</span>
            </div>
          )}
        </>
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-40 rounded-b-lg"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </GlassCard>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

// -- Main dashboard page
export default function DashboardPage() {
  const router = useRouter();
  const [nlpInput, setNlpInput] = useState("");
  const [nlpResult, setNlpResult] = useState<Record<string, unknown> | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/research?q=${encodeURIComponent(q)}`);
  }

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
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetcher("/api/health"),
    refetchInterval: 30_000,
  });
  const svcDisplay = (status?: string, okLabel = "online") => {
    if (status === "ok") return { status: okLabel, color: "var(--green)" };
    if (status === "degraded") return { status: "degraded", color: "#eab308" };
    if (status === "down") return { status: "offline", color: "var(--red)" };
    return { status: okLabel, color: "var(--green)" };
  };
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
  const macroScore = Number((macroData as { score?: unknown })?.score ?? 0);
  const macroRegime = macroScore >= 66 ? "Risk-On" : macroScore <= 33 && macroScore > 0 ? "Risk-Off" : "Neutral";
  const macroColor = macroScore >= 66 ? "var(--green)" : macroScore <= 33 && macroScore > 0 ? "var(--red)" : "var(--orange)";

  const sectors: Array<Record<string, unknown>> = (() => {
    const raw = sectorsRaw as unknown;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    const d = (raw as Record<string, unknown>)?.data ?? raw;
    if (Array.isArray(d)) return d as Array<Record<string, unknown>>;
    return [];
  })();

  const signals: Array<Record<string, unknown>> = Array.isArray(signalsRaw)
    ? (signalsRaw as Array<Record<string, unknown>>)
    : [];

  const portfolio = (portfolioRaw as Record<string, unknown>) ?? {};
  const summary = ((portfolio as { summary?: Record<string, unknown> })?.summary ?? portfolio) as Record<string, unknown>;
  const totalVal = Number(summary?.totalValueUsd ?? 0);
  const pnl = Number(summary?.totalPnlUsd ?? 0);
  const pnlPct = Number(summary?.totalPnlPct ?? 0);
  const { data: trackRaw } = useQuery({
    queryKey: ["track-record-summary"],
    queryFn: () => fetchWithMeta<any>("/api/signals/track-record"),
    refetchInterval: 120_000,
  });
  const { isComplete: setupComplete, nextStep } = useSetupProgress();

  const trSummary = (trackRaw as { data?: Record<string, unknown> })?.data ?? {};
  const hitRatePct = trSummary.hit_rate != null ? (Number(trSummary.hit_rate) * 100).toFixed(0) : null;
  const topSignal = signals[0];
  const topAsset = String(topSignal?.asset ?? topSignal?.symbol ?? "ETH").replace(/USDT|USDC|\/.*/, "");
  const activeSignals = signals.filter((s) => s.status === "active" || s.status === "pending").length || signals.length;
  const topSector = [...sectors].sort((a, b) => Number(b.change_pct_24h ?? 0) - Number(a.change_pct_24h ?? 0))[0];

  const primaryCtaHref = !setupComplete && nextStep?.href
    ? nextStep.href
    : topSignal?.id
      ? `/trade?signalId=${topSignal.id}&asset=${topAsset}`
      : `/trade?asset=${topAsset}`;
  const primaryCtaLabel = !setupComplete
    ? "Continue Setup"
    : topSignal
      ? `Trade Latest · ${topAsset}`
      : "Open Trade Desk";

  const containerV = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
  };
  const itemV = {
    hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
    visible: {
      opacity: 1, y: 0, filter: "blur(0px)",
      transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
              style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", fontFamily: "var(--font-mono)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              Live &middot; Agentic OS
            </span>
          </div>
          <motion.h1
            className="font-black leading-none"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.05em", color: "var(--text-primary)" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
            initial="hidden"
            animate="visible"
          >
            {"Overview".split("").map((char, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            SoSoValue &middot; SoDEX &middot; Multi-agent crypto intelligence
          </p>
        </motion.div>

        {/* Search + Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3"
        >
          <form onSubmit={handleSearch}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", minWidth: 200 }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets, news&hellip;"
                aria-label="Search &mdash; press Enter to research"
                className="text-sm bg-transparent outline-none w-full"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-body)" }}
              />
            </div>
          </form>
          <button
            aria-label="Notifications"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}
          >
            <Bell className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 4px var(--accent)" }} />
          </button>
          <Link
            href="/profile"
            aria-label="View profile"
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all hover:scale-105"
            style={{ background: "var(--grad-orange)", color: "#fff", boxShadow: "0 4px 12px rgba(249,115,22,0.30)" }}
          >
            A
          </Link>
        </motion.div>
      </div>

      {/* Loop hero — single primary CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <GlassCard padding="md" className="lg:col-span-2" animate spotlight>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] mb-1">Trustworthy Trading Loop</p>
              <h2 className="text-lg font-black text-[var(--text-primary)]">
                {hitRatePct ? `${hitRatePct}% hit rate` : "Live proof ledger"} · {activeSignals} signals
              </h2>
              <p className="text-xs mt-1 text-[var(--text-muted)]">
                SoSoValue intel → explainable signal → risk preflight → signed SoDEX order → public outcomes
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={primaryCtaHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <CandlestickChart className="w-4 h-4" />
                {primaryCtaLabel}
              </Link>
              <button
                type="button"
                onClick={() => startJudgePath()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "var(--glass-border)", color: "var(--text-secondary)" }}
              >
                <Target className="w-4 h-4" />
                Judge Path
              </button>
              <Link href="/track-record" className="inline-flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-[var(--accent)]">
                Track Record <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </GlassCard>
        {!setupComplete ? (
          <SetupProgress variant="card" />
        ) : (
          <GlassCard padding="md" animate>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--green)] mb-2">Ready</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">SoDEX testnet connected</p>
            <Link href="/portfolio" className="text-xs font-semibold mt-2 inline-flex items-center gap-1 text-[var(--accent)]">
              View portfolio <ArrowRight className="w-3 h-3" />
            </Link>
          </GlassCard>
        )}
      </motion.div>

      {/* Live Ticker */}
      <LiveTicker />

      {/* Stat Cards */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={containerV} initial="hidden" animate="visible">
        <motion.div variants={itemV}>
          <StatCard
            icon={<Wallet className="w-3.5 h-3.5" />}
            label="Portfolio Value"
            href="/portfolio"
            value={totalVal > 0 ? `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            sub={totalVal > 0 ? `${(summary?.positions as number) ?? 0} positions active` : undefined}
            pnl={pnl !== 0 ? pnl : undefined}
            pnlPct={pnlPct !== 0 ? pnlPct : undefined}
            color="var(--accent)"
            empty={totalVal === 0 ? "No positions yet" : undefined}
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Active Signals"
            href="/signals"
            value={activeSignals > 0 ? String(activeSignals) : "—"}
            sub={activeSignals > 0 ? "AI-generated \u00b7 live" : "Awaiting market data"}
            color="var(--purple)"
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<Globe2 className="w-3.5 h-3.5" />}
            label="Macro Score"
            href="/agents"
            value={macroScore > 0 ? String(macroScore) : "—"}
            sub={macroScore > 0 ? `${macroRegime} regime` : "Loading\u2026"}
            color={macroScore > 0 ? macroColor : "var(--orange)"}
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="Top Sector 24h"
            href="/sectors"
            value={topSector ? String(topSector.name ?? "—") : "—"}
            sub={topSector ? `+${Number(topSector.change_pct_24h ?? 0).toFixed(2)}% change` : "Loading sectors\u2026"}
            color="var(--blue)"
          />
        </motion.div>
      </motion.div>

      {/* Main bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left 2/3: Signal Feed + Sector Heatmap */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    AI Signal Feed
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Real-time agent-generated signals</p>
                </div>
                <Link href="/signals" className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2" style={{ color: "var(--accent)" }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <SignalFeed signals={signals} />
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Layers className="w-4 h-4" style={{ color: "var(--blue)" }} />
                    Sector Momentum
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>24h sector rotation heat</p>
                </div>
                <Link href="/sectors"><BarChart3 className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></Link>
              </div>
              <SectorHeatmap sectors={sectors as { name: string; change_pct_24h?: number; market_cap?: number }[]} />
            </GlassCard>
          </motion.div>
        </div>

        {/* Right 1/3: Macro Regime + System Status */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard padding="md" animate={false} glow="orange">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Globe2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Macro Regime
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    Risk score &middot; ETF + Events
                  </p>
                </div>
                <Link href="/agents"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></Link>
              </div>

              <MacroGauge score={macroScore} />

              <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: `${macroColor}15`, border: `1px solid ${macroColor}30` }}>
                <span className="text-xs font-semibold" style={{ color: macroColor, fontFamily: "var(--font-mono)" }}>
                  {macroScore > 0 ? macroRegime : "Calculating\u2026"}
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: macroColor, fontFamily: "var(--font-mono)" }}>
                  {macroScore > 0 ? `${macroScore}/100` : "—"}
                </span>
              </div>

              {Array.isArray((macroData as { drivers?: unknown[] })?.drivers) && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Key Drivers</div>
                  {(macroData as { drivers: string[] }).drivers.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b last:border-0" style={{ color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--text-muted)" }} />
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4" style={{ color: "var(--green)" }} />
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>System Status</h2>
                <Link href="/status" className="ml-auto"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></Link>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "SoSoValue API", ...svcDisplay((health as any)?.services?.sosovalue?.status) },
                  { label: "SoDEX Feed", ...svcDisplay((health as any)?.services?.sodex?.status) },
                  { label: "AI Agents", ...svcDisplay((health as any)?.services?.ai?.status, "online") },
                  { label: "WebSocket", ...svcDisplay((health as any)?.services?.websocket?.status, "live") },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{item.label}</span>
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

      {/* Funding Rate Signals */}
      {funding.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
          <GlassCard padding="md" animate={false}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2 mb-0.5" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                  <Radio className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Funding Rate Signals
                </h2>
                <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Extreme funding = mean reversion opportunity</p>
              </div>
              <Link href="/research" className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2" style={{ color: "var(--accent)" }}>
                More <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {funding.slice(0, 6).map((f, i) => {
                const rate = Number(f.funding_rate ?? 0);
                const dir = String(f.signal ?? f.direction ?? "neutral");
                const isLong = dir.includes("buy") || dir.includes("long");
                const isShort = dir.includes("sell") || dir.includes("short");
                const color = isLong ? "var(--green)" : isShort ? "var(--red)" : "var(--text-muted)";
                return (
                  <motion.div key={i} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="flex items-center justify-between p-3 rounded-xl border cursor-default"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
                  >
                    <span className="font-bold text-sm" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {String(f.symbol ?? f.asset ?? "")}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-bold" style={{ color, fontFamily: "var(--font-mono)" }}>{(rate * 100).toFixed(4)}%</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{dir.replace("_", " ")}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* AI Trade Assistant */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
        <GlassCard padding="md" animate={false}>
          <div className="mb-3">
            <h2 className="text-base font-bold flex items-center gap-2 mb-0.5" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
              <ArrowUpDown className="w-4 h-4" style={{ color: "var(--purple)" }} />
              AI Trade Assistant
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Type a trade intent in natural language</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && parseNlp()}
              placeholder='e.g. "buy 0.1 BTC with 5x leverage" or "close ETH position"'
              className="flex-1 px-4 py-2.5 rounded-xl text-sm placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--glass-border)")}
            />
            <button
              onClick={parseNlp}
              disabled={nlpLoading || !nlpInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap transition-all"
              style={{ background: "var(--grad-orange)", color: "#fff", boxShadow: "0 4px 16px rgba(249,115,22,0.25)" }}
            >
              <Send className="w-3.5 h-3.5" />
              {nlpLoading ? "Parsing\u2026" : "Parse"}
            </button>
          </div>
          {nlpResult && (
            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
              {(nlpResult as { error?: string }).error ? (
                <span style={{ color: "var(--red)" }}>{(nlpResult as { error: string }).error}</span>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {Object.entries(nlpResult as Record<string, unknown>)
                      .filter(([, v]) => v != null && v !== "")
                      .map(([k, v]) => (
                        <div key={k}>
                          <div className="font-semibold capitalize mb-0.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                            {k.replace(/_/g, " ")}
                          </div>
                          <div className="font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                  {(nlpResult as any)?.intent?.kind === "trade" && (
                    <button
                      onClick={() => {
                        const r = (nlpResult as any).intent;
                        const params = new URLSearchParams();
                        if (r.asset) params.set("asset", String(r.asset).toUpperCase());
                        if (r.action) params.set("side", r.action);
                        if (r.amount) params.set("qty", String(r.amount));
                        if (r.orderType) params.set("type", r.orderType);
                        if (r.price) params.set("price", String(r.price));
                        router.push(`/trade?${params.toString()}`);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold w-full justify-center transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "var(--grad-orange)", color: "#fff", boxShadow: "0 4px 16px rgba(249,115,22,0.3)" }}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Execute Trade on SoDEX
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </GlassCard>
      </motion.div>

    </div>
  );
}