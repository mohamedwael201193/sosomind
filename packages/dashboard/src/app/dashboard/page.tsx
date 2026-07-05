"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { fetchWithMeta, fetcher } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { GlassCard } from "@/components/GlassCard";
import { LiveTicker } from "@/components/LiveTicker";
import { MacroGauge } from "@/components/MacroGauge";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { SignalFeed } from "@/components/SignalFeed";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Wallet, Zap, Globe2, BarChart3,
  Activity, ArrowRight, Send, Radio, ArrowUpDown,
  Bell, Search, Layers, ExternalLink, CandlestickChart,
} from "lucide-react";
import { SetupProgress } from "@/components/SetupProgress";
import { ProductJourney } from "@/components/ProductJourney";
import { useSetupProgress } from "@/hooks/useSetupProgress";
import { useWallet } from "@/context/WalletContext";
import { useEnvironment } from "@/context/EnvironmentContext";

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
          className="text-xs font-semibold tracking-wide"
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
  if (href) {
    return (
      <Link
        to={href}
        className="block rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

// -- Main dashboard page
export default function DashboardPage() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { selector, config } = useEnvironment();
  const envLabel = config?.active?.label ?? (selector === 'testnet' ? 'Testnet' : 'Mainnet');
  const walletInitials = address ? address.slice(2, 4).toUpperCase() : null;
  const [nlpInput, setNlpInput] = useState("");
  const [nlpResult, setNlpResult] = useState<Record<string, unknown> | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/research?q=${encodeURIComponent(q)}`);
  }

  async function parseNlp() {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    setNlpResult(null);
    try {
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
    staleTime: 120_000,
    refetchInterval: 180_000,
  });
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetcher("/api/health"),
    staleTime: 30_000,
    refetchInterval: 60_000,
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
    staleTime: 120_000,
    refetchInterval: 180_000,
  });
  const { data: signalsRaw } = useQuery({
    queryKey: ["signals-recent"],
    queryFn: () => fetcher("/api/signals?limit=8"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: portfolioRaw } = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: () => fetcher("/api/portfolio"),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const { data: fundingRaw } = useQuery({
    queryKey: ["funding-signals"],
    queryFn: () => fetcher("/api/signals/funding?limit=6"),
    staleTime: 30_000,
    refetchInterval: 90_000,
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
    staleTime: 120_000,
    refetchInterval: 300_000,
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
      ? `Trade ${topAsset}`
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
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full"
              style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", fontFamily: "var(--font-mono)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              Live · {envLabel}
            </span>
          </div>
          <h1
            className="font-black leading-none text-balance"
            style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-hero)", letterSpacing: "-0.045em", color: "var(--text-primary)" }}
          >
            Overview
          </h1>
          <p className="text-sm mt-3 max-w-lg leading-relaxed" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
            Portfolio, risk, and opportunities from live SoDEX and SoSoValue data.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3"
        >
          <form onSubmit={handleSearch}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 focus-within:border-[var(--accent-border)]"
              style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", minWidth: 220 }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets or themes"
                aria-label="Search, press Enter to open research"
                className="text-sm bg-transparent outline-none w-full placeholder:text-[var(--text-muted)]"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-body)" }}
              />
            </div>
          </form>
          <Link
            to="/alerts"
            aria-label="View alerts"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:border-[var(--accent-border)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
            style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}
          >
            <Bell className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </Link>
          <Link
            to="/profile"
            aria-label={address ? `Profile ${address.slice(0, 6)}…${address.slice(-4)}` : "View profile"}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
            style={{ background: "var(--grad-orange)", color: "#fff", boxShadow: "0 4px 16px rgba(249,115,22,0.25)", fontFamily: "var(--font-mono)" }}
          >
            {walletInitials ?? "?"}
          </Link>
        </motion.div>
      </div>

      {/* Primary story: 5 focus metrics */}
      <motion.div className="grid grid-cols-2 xl:grid-cols-5 gap-4" variants={containerV} initial="hidden" animate="visible">
        <motion.div variants={itemV}>
          <StatCard
            icon={<Wallet className="w-3.5 h-3.5" />}
            label="Portfolio"
            href="/portfolio"
            value={totalVal > 0 ? `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Unavailable"}
            sub={totalVal > 0 ? `${(summary?.positions as number) ?? 0} positions` : "Connect wallet for SoDEX balances"}
            color="var(--accent)"
            empty={totalVal === 0 ? "No portfolio data" : undefined}
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<Globe2 className="w-3.5 h-3.5" />}
            label="Current risk"
            href="/agents"
            value={macroScore > 0 ? macroRegime : "Unavailable"}
            sub={macroScore > 0 ? `Macro score ${macroScore}/100` : "Awaiting macro feed"}
            color={macroScore > 0 ? macroColor : "var(--text-muted)"}
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<Zap className="w-3.5 h-3.5" />}
            label="AI recommendation"
            href={topSignal?.id ? `/signals/${topSignal.id}` : "/signals"}
            value={topSignal ? String(topAsset) : "Unavailable"}
            sub={topSignal ? `${String(topSignal.direction ?? "signal").toUpperCase()} · ${activeSignals} active` : "No active signals"}
            color="var(--accent)"
          />
        </motion.div>
        <motion.div variants={itemV}>
          <StatCard
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="Market regime"
            href="/agents"
            value={macroScore > 0 ? `${macroScore}` : "—"}
            sub={macroScore > 0 ? macroRegime : "Loading"}
            color={macroColor}
          />
        </motion.div>
        <motion.div variants={itemV} className="col-span-2 xl:col-span-1">
          <StatCard
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Opportunities"
            href="/sectors"
            value={topSector ? String(topSector.name ?? "—") : "—"}
            sub={topSector ? `+${Number(topSector.change_pct_24h ?? 0).toFixed(2)}% 24h` : "SSI sectors loading"}
            color="var(--accent)"
          />
        </motion.div>
      </motion.div>

      {/* AI action strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <GlassCard padding="md" className="lg:col-span-2" animate={false} spotlight>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                {topSignal ? `Suggested action on ${topAsset}` : "Ready to trade"}
              </h2>
              <p className="text-sm mt-1.5 max-w-xl text-[var(--text-secondary)]">
                {hitRatePct ? `${hitRatePct}% resolved hit rate on track record.` : "Evidence-backed signals with signed SoDEX execution."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={primaryCtaHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <CandlestickChart className="w-4 h-4" />
                {primaryCtaLabel}
              </Link>
              <Link
                to="/signals"
                className="inline-flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] rounded-xl border transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
                style={{ borderColor: "var(--glass-border)" }}
              >
                All signals <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </GlassCard>
        {!setupComplete ? (
          <SetupProgress variant="card" />
        ) : (
          <GlassCard padding="md" animate={false}>
            <p className="text-[10px] font-semibold tracking-wide text-[var(--green)] mb-2">Account ready</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">Trading preflight passed</p>
            <Link to="/portfolio" className="text-xs font-semibold mt-2 inline-flex items-center gap-1 text-[var(--accent)]">
              Open portfolio <ArrowRight className="w-3 h-3" />
            </Link>
          </GlassCard>
        )}
      </motion.div>

      <ProductJourney />

      <LiveTicker />

      {/* Main bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left 2/3: Signal Feed + Sector Heatmap */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
            <GlassCard padding="md" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2 text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Signal feed
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Latest agent outputs</p>
                </div>
                <Link to="/signals" className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2" style={{ color: "var(--accent)" }}>
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
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2 text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Layers className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Sector momentum
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>24h rotation heat</p>
                </div>
                <Link to="/sectors"><BarChart3 className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></Link>
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
                  <h2 className="text-base font-bold mb-0.5 flex items-center gap-2 text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    <Globe2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Macro regime
                  </h2>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    Risk score · ETF + events
                  </p>
                </div>
                <Link to="/agents"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></Link>
              </div>

              <MacroGauge score={macroScore} />

              <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: `${macroColor}15`, border: `1px solid ${macroColor}30` }}>
                <span className="text-xs font-semibold" style={{ color: macroColor, fontFamily: "var(--font-mono)" }}>
                  {macroScore > 0 ? macroRegime : "Calculating\u2026"}
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: macroColor, fontFamily: "var(--font-mono)" }}>
                  {macroScore > 0 ? `${macroScore}/100` : "?"}
                </span>
              </div>

              {Array.isArray((macroData as { drivers?: unknown[] })?.drivers) && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] tracking-wide mb-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Key drivers</div>
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
                <h2 className="text-base font-bold text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>System status</h2>
                <Link to="/status" className="ml-auto"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></Link>
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
                <h2 className="text-base font-bold flex items-center gap-2 mb-0.5 text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                  <Radio className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  Funding rate signals
                </h2>
                <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Extreme funding · mean reversion watch</p>
              </div>
              <Link to="/research" className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2" style={{ color: "var(--accent)" }}>
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
            <h2 className="text-base font-bold flex items-center gap-2 mb-0.5 text-balance" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
              <ArrowUpDown className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Trade assistant
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Describe a trade in plain language</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && parseNlp()}
              placeholder='e.g. "buy 0.003 ETH market"'
              className="flex-1 px-4 py-2.5 rounded-xl text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] transition-colors duration-200"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--glass-border)")}
            />
            <button
              onClick={parseNlp}
              disabled={nlpLoading || !nlpInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
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
                        navigate(`/trade?${params.toString()}`);
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