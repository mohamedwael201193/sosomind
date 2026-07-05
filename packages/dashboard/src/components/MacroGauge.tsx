"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

export interface MacroOutlookData {
  regime?: "risk-on" | "risk-off" | "neutral";
  score?: number;
  drivers?: string[];
  breakdown?: Record<string, number>;
  upcomingEvents?: Array<{ name: string; date: string; importance: string }>;
}

interface MacroRegimePanelProps {
  data?: MacroOutlookData | null;
  isLoading?: boolean;
  isFetching?: boolean;
}

const BREAKDOWN_META: Record<
  string,
  { label: string; color: string; icon: typeof TrendingUp }
> = {
  etf_flow: { label: "ETF flow", color: "#3b82f6", icon: TrendingUp },
  btc_momentum: { label: "BTC momentum", color: "#8b5cf6", icon: Activity },
  macro_risk: { label: "Macro safety", color: "#f97316", icon: AlertCircle },
  sentiment: { label: "Composite", color: "#22c55e", icon: Zap },
};

function regimeMeta(regime: MacroOutlookData["regime"], score: number) {
  if (regime === "risk-on" || score >= 60) {
    return {
      label: "Risk-on",
      sub: "Favorable for long exposure",
      color: "#22c55e",
      glow: "rgba(34,197,94,0.35)",
    };
  }
  if (regime === "risk-off" || score <= 40) {
    return {
      label: "Risk-off",
      sub: "Defensive positioning",
      color: "#ef4444",
      glow: "rgba(239,68,68,0.35)",
    };
  }
  return {
    label: "Neutral",
    sub: "Mixed macro signals",
    color: "#f97316",
    glow: "rgba(249,115,22,0.35)",
  };
}

function driverIcon(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("etf")) return TrendingUp;
  if (lower.includes("btc")) return Activity;
  if (lower.includes("upcoming")) return Calendar;
  if (lower.includes("-")) return TrendingDown;
  return Zap;
}

function formatEventDate(raw: string) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RegimeGauge({ score, color, glow }: { score: number; color: string; glow: string }) {
  const reduceMotion = useReducedMotion();
  const uid = useId();
  const clamp = Math.max(0, Math.min(100, score));
  const angle = -135 + (clamp / 100) * 270;
  const cx = 120;
  const cy = 118;
  const r = 78;

  const arc = (startDeg: number, endDeg: number, stroke: string, width = 10, opacity = 1) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  };

  return (
    <svg viewBox="0 0 240 168" className="w-full max-w-[260px] mx-auto" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {arc(-135, 135, "rgba(255,255,255,0.06)", 10)}
      {arc(-135, -45, "rgba(239,68,68,0.18)", 10)}
      {arc(-45, 45, "rgba(249,115,22,0.18)", 10)}
      {arc(45, 135, "rgba(34,197,94,0.18)", 10)}

      {clamp > 0 && (
        <motion.path
          d={(() => {
            const end = -135 + (clamp / 100) * 270;
            const s = (-135 * Math.PI) / 180;
            const e = (end * Math.PI) / 180;
            const x1 = cx + r * Math.cos(s);
            const y1 = cy + r * Math.sin(s);
            const x2 = cx + r * Math.cos(e);
            const y2 = cy + r * Math.sin(e);
            const large = end + 135 > 180 ? 1 : 0;
            return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
          })()}
          fill="none"
          stroke={`url(#${uid}-fill)`}
          strokeWidth="10"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {[0, 25, 50, 75, 100].map((v) => {
        const a = ((-135 + (v / 100) * 270) * Math.PI) / 180;
        const ri = r - 8;
        const ro = r + 5;
        return (
          <line
            key={v}
            x1={cx + ri * Math.cos(a)}
            y1={cy + ri * Math.sin(a)}
            x2={cx + ro * Math.cos(a)}
            y2={cy + ro * Math.sin(a)}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.5"
          />
        );
      })}

      <motion.g
        animate={{ rotate: angle + 90 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 120, damping: 18 }
        }
      >
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - r + 10}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </motion.g>

      <circle cx={cx} cy={cy} r="7" fill={color} style={{ filter: `drop-shadow(0 0 10px ${glow})` }} />
      <circle cx={cx} cy={cy} r="3" fill="var(--bg-base, #0a0806)" />

      <text
        x={cx}
        y={cy + 30}
        textAnchor="middle"
        fill="var(--text-primary, #fafafa)"
        fontSize="28"
        fontWeight="800"
        style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
      >
        {clamp}
      </text>
      <text
        x={cx}
        y={cy + 46}
        textAnchor="middle"
        fill="var(--text-muted, rgba(255,255,255,0.45))"
        fontSize="10"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        / 100
      </text>

      <text x="18" y="162" fill="#ef4444" fontSize="8" fontWeight="700" style={{ fontFamily: "var(--font-mono)" }}>
        OFF
      </text>
      <text x="196" y="162" fill="#22c55e" fontSize="8" fontWeight="700" style={{ fontFamily: "var(--font-mono)" }}>
        ON
      </text>
    </svg>
  );
}

function BreakdownBars({ breakdown }: { breakdown: Record<string, number> }) {
  const reduceMotion = useReducedMotion();
  const entries = Object.entries(breakdown);

  return (
    <div className="space-y-3">
      {entries.map(([key, val], i) => {
        const meta = BREAKDOWN_META[key] ?? {
          label: key.replace(/_/g, " "),
          color: "var(--accent)",
          icon: Zap,
        };
        const Icon = meta.icon;
        const n = Math.max(0, Math.min(100, Number(val) || 0));

        return (
          <div key={key} className="group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${meta.color}16`, color: meta.color, boxShadow: `0 0 0 1px ${meta.color}22 inset` }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {meta.label}
              </span>
              <span
                className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                style={{ color: meta.color, background: `${meta.color}12`, fontFamily: "var(--font-mono)" }}
              >
                {n}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden relative"
              style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)" }}
            >
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(90deg, ${meta.color}66, ${meta.color})`,
                  boxShadow: `0 0 12px ${meta.color}70`,
                }}
                initial={{ width: reduceMotion ? `${n}%` : "0%" }}
                animate={{ width: `${n}%` }}
                transition={{
                  delay: reduceMotion ? 0 : 0.1 + i * 0.07,
                  duration: reduceMotion ? 0 : 0.8,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 w-8 -skew-x-12"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
                  animate={reduceMotion ? undefined : { x: ["-40%", "140%"] }}
                  transition={reduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "linear", delay: 1 + i * 0.2 }}
                />
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MacroRegimePanel({ data, isLoading, isFetching }: MacroRegimePanelProps) {
  const score = typeof data?.score === "number" ? data.score : null;
  const breakdown = data?.breakdown ?? {};
  const drivers = Array.isArray(data?.drivers) ? data!.drivers! : [];
  const hasData =
    score !== null ||
    drivers.length > 0 ||
    Object.keys(breakdown).length > 0;
  const displayScore = score ?? 50;
  const meta = regimeMeta(data?.regime, displayScore);
  const nextEvent = data?.upcomingEvents?.[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="relative h-[168px] rounded-xl overflow-hidden flex items-center justify-center skeleton">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(249,115,22,0.35)", borderTopColor: "transparent" }} />
        </div>
        <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-2/3 skeleton" />
              <div className="h-2 w-full skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
          Macro feed unavailable. Retrying on next refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-1.5">
          {isFetching && (
            <RefreshCw className="w-3 h-3 text-[var(--text-muted)] animate-spin" aria-hidden />
          )}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: `${meta.color}14`,
              color: meta.color,
              border: `1px solid ${meta.color}35`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
            {meta.label}
          </span>
        </div>

        <div className="pt-8">
          <RegimeGauge score={displayScore} color={meta.color} glow={meta.glow} />
        </div>

        <p
          className="text-center text-[11px] -mt-1"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          {meta.sub}
        </p>
      </div>

      {Object.keys(breakdown).length > 0 && (
        <div
          className="rounded-xl p-3.5"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
            border: "1px solid var(--glass-border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center justify-between mb-3.5">
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Score inputs
            </div>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
              {Object.keys(breakdown).length} signals
            </span>
          </div>
          <BreakdownBars breakdown={breakdown} />
        </div>
      )}

      {nextEvent && (
        <div
          className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
          style={{
            background: "rgba(249,115,22,0.08)",
            border: "1px solid rgba(249,115,22,0.22)",
          }}
        >
          <Calendar className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--accent)" }}>
              Next macro event
            </p>
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{nextEvent.name}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
              {formatEventDate(nextEvent.date)}
              {nextEvent.importance ? ` · ${nextEvent.importance}` : ""}
            </p>
          </div>
        </div>
      )}

      {drivers.length > 0 && (
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            Live drivers
          </div>
          <ul className="space-y-1">
            {drivers.slice(0, 4).map((d, i) => {
              const Icon = driverIcon(d);
              return (
                <motion.li
                  key={`${d}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${meta.color}12`, color: meta.color }}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <span className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{d}</span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      <Link
        to="/agents"
        className="group flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[11px] font-semibold transition-all duration-300"
        style={{
          color: "var(--accent)",
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.2)",
        }}
      >
        Full macro analysis
        <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

/** @deprecated Use MacroRegimePanel for dashboard; kept for any legacy imports */
export function MacroGauge({ score = 50 }: { score?: number; label?: string }) {
  return <MacroRegimePanel data={{ score, regime: score >= 60 ? "risk-on" : score <= 40 ? "risk-off" : "neutral" }} />;
}
