"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";

export interface RegimeDialProps {
  score: number;
  size?: "sm" | "lg";
  className?: string;
  /** Show the regime pill + subtitle beneath the dial. Default true. */
  showBadge?: boolean;
}

const SWEEP_START = -132;
const SWEEP_END = 132;
const SWEEP_TOTAL = SWEEP_END - SWEEP_START;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const p1 = polar(cx, cy, r, startDeg);
  const p2 = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
}

function regimeMeta(score: number) {
  if (score >= 60) {
    return { label: "Risk-On", sub: "Favorable for long exposure", color: "#22c55e", color2: "#4ade80" };
  }
  if (score <= 40) {
    return { label: "Risk-Off", sub: "Defensive positioning", color: "#ef4444", color2: "#f87171" };
  }
  return { label: "Neutral", sub: "Mixed macro signals", color: "#f97316", color2: "#fb923c" };
}

/** Counts up to `value` on mount / whenever it changes, honoring reduced-motion. */
function useCountUp(value: number, durationMs: number, reduceMotion: boolean | null) {
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = display;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduceMotion]);

  return display;
}

/**
 * Premium radial regime dial: full-spectrum gradient track, animated progress
 * arc with a glowing tip marker, count-up score readout, and semantic end labels.
 */
export function RegimeDial({ score, size = "lg", className, showBadge = true }: RegimeDialProps) {
  const uid = useId();
  const reduceMotion = useReducedMotion();
  const clamp = Math.max(0, Math.min(100, score));
  const meta = regimeMeta(clamp);
  const displayScore = useCountUp(clamp, 1100, reduceMotion);

  const isSmall = size === "sm";
  const cx = 130;
  const cy = 128;
  const r = isSmall ? 78 : 92;
  const trackWidth = isSmall ? 11 : 13;
  const viewW = 260;
  const viewH = isSmall ? 186 : 214;

  const tipDeg = SWEEP_START + (clamp / 100) * SWEEP_TOTAL;
  const tip = polar(cx, cy, r, tipDeg);

  return (
    <div className={`relative flex flex-col items-center ${className ?? ""}`}>
      {/* Ambient color-matched halo behind the dial */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: r * 2.1,
          height: r * 2.1,
          top: cy - r * 1.05,
          left: "50%",
          transform: "translateX(-50%)",
          background: `radial-gradient(circle, ${meta.color}2e 0%, transparent 72%)`,
          filter: "blur(6px)",
        }}
      />

      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="relative w-full"
        style={{ maxWidth: isSmall ? 260 : 300 }}
        role="img"
        aria-label={`Macro regime score ${clamp} out of 100, ${meta.label}`}
      >
        <defs>
          <linearGradient id={`${uid}-spectrum`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id={`${uid}-progress`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={meta.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={meta.color2} stopOpacity="1" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Full-spectrum context track (dim) */}
        <path
          d={arcPath(cx, cy, r, SWEEP_START, SWEEP_END)}
          fill="none"
          stroke={`url(#${uid}-spectrum)`}
          strokeWidth={trackWidth}
          strokeLinecap="round"
          opacity={0.16}
        />

        {/* Recessed inner shadow line for depth */}
        <path
          d={arcPath(cx, cy, r, SWEEP_START, SWEEP_END)}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={trackWidth - 6}
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((v) => {
          const deg = SWEEP_START + (v / 100) * SWEEP_TOTAL;
          const inner = polar(cx, cy, r - trackWidth / 2 - 5, deg);
          const outer = polar(cx, cy, r + trackWidth / 2 + 3, deg);
          const major = v === 0 || v === 50 || v === 100;
          return (
            <line
              key={v}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={major ? 1.6 : 1}
            />
          );
        })}

        {/* Animated progress arc */}
        {clamp > 0 && (
          <motion.path
            d={arcPath(cx, cy, r, SWEEP_START, tipDeg)}
            fill="none"
            stroke={`url(#${uid}-progress)`}
            strokeWidth={trackWidth}
            strokeLinecap="round"
            filter={`url(#${uid}-glow)`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* Glowing tip marker with pulse */}
        {clamp > 0 && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.9, duration: 0.3 }}
          >
            {!reduceMotion && (
              <motion.circle
                cx={tip.x}
                cy={tip.y}
                r={trackWidth / 2 + 1}
                fill="none"
                stroke={meta.color}
                strokeWidth={1.5}
                animate={{ r: [trackWidth / 2 + 1, trackWidth / 2 + 9], opacity: [0.55, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.1 }}
              />
            )}
            <circle cx={tip.x} cy={tip.y} r={trackWidth / 2 + 2.5} fill="var(--bg-base, #0a0806)" />
            <circle
              cx={tip.x}
              cy={tip.y}
              r={trackWidth / 2 - 0.5}
              fill={meta.color2}
              style={{ filter: `drop-shadow(0 0 7px ${meta.color})` }}
            />
          </motion.g>
        )}

        {/* End labels: risk-off / risk-on */}
        <g transform={`translate(${polar(cx, cy, r + trackWidth + 14, SWEEP_START).x}, ${polar(cx, cy, r + trackWidth + 14, SWEEP_START).y})`}>
          <foreignObject x={-34} y={-9} width={68} height={18} style={{ overflow: "visible" }}>
            <div className="flex items-center gap-1 text-[9px] font-bold" style={{ color: "#ef4444" }}>
              <TrendingDown className="w-2.5 h-2.5" /> RISK-OFF
            </div>
          </foreignObject>
        </g>
        <g transform={`translate(${polar(cx, cy, r + trackWidth + 14, SWEEP_END).x - 52}, ${polar(cx, cy, r + trackWidth + 14, SWEEP_END).y})`}>
          <foreignObject x={-2} y={-9} width={68} height={18} style={{ overflow: "visible" }}>
            <div className="flex items-center gap-1 text-[9px] font-bold" style={{ color: "#22c55e" }}>
              RISK-ON <TrendingUp className="w-2.5 h-2.5" />
            </div>
          </foreignObject>
        </g>
      </svg>

      {/* Center readout, overlaid on the dial */}
      <div
        className="absolute flex flex-col items-center pointer-events-none"
        style={{ top: isSmall ? "38%" : "40%" }}
      >
        <span
          className="font-black tabular-nums leading-none"
          style={{
            fontSize: isSmall ? 40 : 48,
            fontFamily: "var(--font-display)",
            color: meta.color2,
            filter: `drop-shadow(0 0 14px ${meta.color}55)`,
          }}
        >
          {displayScore}
        </span>
        <span
          className="text-[10px] font-semibold tracking-wide mt-0.5"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          / 100
        </span>
      </div>

      {/* Regime badge + subtitle, below the dial */}
      {showBadge && (
        <div className="flex flex-col items-center -mt-1 gap-1">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${meta.color}16`, color: meta.color, border: `1px solid ${meta.color}38` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
            {meta.label}
          </span>
          <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {meta.sub}
          </p>
        </div>
      )}
    </div>
  );
}
