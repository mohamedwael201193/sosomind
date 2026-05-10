"use client";
import React, { useId } from "react";

// ── LogoMark ─────────────────────────────────────────────────────────────────
// Premium hexagonal circuit-S mark — inline SVG, no image dependency
interface LogoMarkProps {
  size?: number;
  className?: string;
}

export const LogoMark = ({ size = 40, className = "" }: LogoMarkProps) => {
  const id = useId().replace(/:/g, "");
  const glow      = `${id}glow`;
  const traceGlow = `${id}tg`;
  const nodeGlow  = `${id}ng`;
  const hexGrad   = `${id}hg`;
  const bgGrad    = `${id}bg`;
  const sGrad     = `${id}sg`;
  const cGlow     = `${id}cg`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SoSoMind"
    >
      <defs>
        {/* Outer glow */}
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Trace glow */}
        <filter id={traceGlow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Node glow */}
        <filter id={nodeGlow} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Hex border gradient top-gold → mid-orange → bottom-deep */}
        <linearGradient id={hexGrad} x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor="#fcd34d" />
          <stop offset="45%"  stopColor="#f97316" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>
        {/* Dark interior radial */}
        <radialGradient id={bgGrad} cx="38%" cy="32%" r="68%">
          <stop offset="0%"   stopColor="#1e0d00" />
          <stop offset="100%" stopColor="#060606" />
        </radialGradient>
        {/* S trace gradient */}
        <linearGradient id={sGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="40%"  stopColor="#f97316" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        {/* Center node radial glow */}
        <radialGradient id={cGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fef3c7" stopOpacity="1" />
          <stop offset="35%"  stopColor="#f97316" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Ambient outer glow halo ──────────────────────────── */}
      <polygon
        points="48,1 88,23 88,73 48,95 8,73 8,23"
        fill="none" stroke="#f97316" strokeWidth="1.5"
        opacity="0.18" filter={`url(#${glow})`}
      />

      {/* ── Main hexagon body ────────────────────────────────── */}
      <polygon
        points="48,5 84,26 84,70 48,91 12,70 12,26"
        fill={`url(#${bgGrad})`}
        stroke={`url(#${hexGrad})`}
        strokeWidth="2.2"
      />

      {/* ── Inner hex fine ring ──────────────────────────────── */}
      <polygon
        points="48,11 79,30 79,66 48,85 17,66 17,30"
        fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.18"
      />

      {/* ── Hex vertex circuit nodes ─────────────────────────── */}
      {([[48,5],[84,26],[84,70],[48,91],[12,70],[12,26]] as [number,number][]).map(([cx,cy],i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="4"   fill="#f97316" opacity="0.5" filter={`url(#${glow})`} />
          <circle cx={cx} cy={cy} r="2.2" fill="#f97316" />
          <circle cx={cx} cy={cy} r="1"   fill="#fde68a" />
        </g>
      ))}

      {/* ── Circuit traces from each corner inward ───────────── */}
      <line x1="48" y1="11"  x2="48" y2="22"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />
      <line x1="79" y1="35"  x2="72" y2="39"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />
      <line x1="79" y1="61"  x2="72" y2="57"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />
      <line x1="48" y1="85"  x2="48" y2="74"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />
      <line x1="17" y1="61"  x2="24" y2="57"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />
      <line x1="17" y1="35"  x2="24" y2="39"  stroke="#f97316" strokeWidth="0.9" opacity="0.35" />

      {/* ── Small corner pad dots at trace ends ──────────────── */}
      <circle cx="48" cy="22"  r="1.4" fill="#f97316" opacity="0.55" />
      <circle cx="72" cy="39"  r="1.4" fill="#f97316" opacity="0.55" />
      <circle cx="72" cy="57"  r="1.4" fill="#f97316" opacity="0.55" />
      <circle cx="48" cy="74"  r="1.4" fill="#f97316" opacity="0.55" />
      <circle cx="24" cy="57"  r="1.4" fill="#f97316" opacity="0.55" />
      <circle cx="24" cy="39"  r="1.4" fill="#f97316" opacity="0.55" />

      {/* ── S letterform — main circuit trace ────────────────── */}
      <path
        d="M 65,31
           C 65,20 57,16 48,16
           C 37,16 30,23 30,33
           C 30,42 38,46 48,50
           C 58,54 66,59 66,68
           C 66,78 57,81 48,81
           C 37,81 30,75 30,66"
        fill="none"
        stroke={`url(#${sGrad})`}
        strokeWidth="4.8"
        strokeLinecap="round"
        filter={`url(#${traceGlow})`}
      />

      {/* ── Perpendicular PCB pads along the S ───────────────── */}
      {/* Top-right arm out */}
      <line x1="65" y1="31" x2="73" y2="26" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <circle cx="73" cy="26" r="1.8" fill="#f97316" filter={`url(#${glow})`} />
      <circle cx="73" cy="26" r="0.9" fill="#fde68a" />
      {/* Top-left curve pad */}
      <line x1="30" y1="33" x2="22" y2="33" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="22" cy="33" r="1.5" fill="#f97316" opacity="0.7" />
      {/* Bottom-right curve pad */}
      <line x1="66" y1="68" x2="74" y2="68" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="74" cy="68" r="1.5" fill="#f97316" opacity="0.7" />
      {/* Bottom-left arm out */}
      <line x1="30" y1="66" x2="22" y2="71" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <circle cx="22" cy="71" r="1.8" fill="#f97316" filter={`url(#${glow})`} />
      <circle cx="22" cy="71" r="0.9" fill="#fde68a" />

      {/* ── S endpoint nodes ─────────────────────────────────── */}
      <circle cx="65" cy="31" r="3.5"  fill="#f97316" filter={`url(#${glow})`} opacity="0.9" />
      <circle cx="65" cy="31" r="2"    fill="#f97316" />
      <circle cx="65" cy="31" r="0.9"  fill="#fde68a" />
      <circle cx="30" cy="66" r="3.5"  fill="#f97316" filter={`url(#${glow})`} opacity="0.9" />
      <circle cx="30" cy="66" r="2"    fill="#f97316" />
      <circle cx="30" cy="66" r="0.9"  fill="#fde68a" />

      {/* ── Center inflection glow node ───────────────────────── */}
      <circle cx="48" cy="50" r="10" fill={`url(#${cGlow})`} opacity="0.55" />
      <circle cx="48" cy="50" r="5.5" fill="#f97316" filter={`url(#${nodeGlow})`} opacity="0.95" />
      <circle cx="48" cy="50" r="3"   fill="#fde68a" />
      <circle cx="48" cy="50" r="1.3" fill="#ffffff" />

      {/* ── Radial spark lines from center ───────────────────── */}
      <line x1="48" y1="43" x2="48" y2="39" stroke="#fde68a" strokeWidth="0.9" opacity="0.65" strokeLinecap="round" />
      <line x1="54" y1="45" x2="57" y2="42" stroke="#fde68a" strokeWidth="0.9" opacity="0.65" strokeLinecap="round" />
      <line x1="42" y1="45" x2="39" y2="42" stroke="#fde68a" strokeWidth="0.9" opacity="0.65" strokeLinecap="round" />
      <line x1="48" y1="57" x2="48" y2="61" stroke="#fde68a" strokeWidth="0.9" opacity="0.55" strokeLinecap="round" />
      <line x1="54" y1="55" x2="57" y2="58" stroke="#fde68a" strokeWidth="0.9" opacity="0.55" strokeLinecap="round" />
      <line x1="42" y1="55" x2="39" y2="58" stroke="#fde68a" strokeWidth="0.9" opacity="0.55" strokeLinecap="round" />
    </svg>
  );
};

// ── LogoWordmark ──────────────────────────────────────────────────────────────
// Icon + "SoSo" text + "Mind" accent — handles dark/light mode via prop
interface LogoWordmarkProps {
  size?: number;
  theme?: "dark" | "light";
  className?: string;
  showSubtitle?: boolean;
}

export const LogoWordmark = ({
  size = 44,
  theme = "dark",
  className = "",
  showSubtitle = false,
}: LogoWordmarkProps) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div style={{ filter: "drop-shadow(0 0 14px rgba(249,115,22,0.55))", flexShrink: 0 }}>
      <LogoMark size={size} />
    </div>
    <div className="flex flex-col leading-tight">
      <span
        style={{
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 900,
          fontSize: `${Math.round(size * 0.48)}px`,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: theme === "dark" ? "#f1f1f5" : "#111111",
          whiteSpace: "nowrap",
        }}
      >
        SoSo<span style={{ color: "#f97316" }}>Mind</span>
      </span>
      {showSubtitle && (
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: `${Math.round(size * 0.22)}px`,
            color: theme === "dark" ? "rgba(160,160,185,0.7)" : "rgba(80,80,100,0.7)",
            letterSpacing: "0.02em",
            marginTop: 2,
          }}
        >
          Agentic Finance OS
        </span>
      )}
    </div>
  </div>
);
