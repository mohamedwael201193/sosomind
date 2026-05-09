"use client";
import { motion } from "framer-motion";

interface MacroGaugeProps {
  score: number; // 0-100
  label?: string;
}

export function MacroGauge({ score = 50, label = "Macro Regime" }: MacroGaugeProps) {
  const MIN_ANGLE = -120;
  const MAX_ANGLE = 120;
  const angle = MIN_ANGLE + (score / 100) * (MAX_ANGLE - MIN_ANGLE);

  const cx = 90;
  const cy = 90;
  const r = 70;

  function polarToXY(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polarToXY(MIN_ANGLE + 90);
  const end = polarToXY(MAX_ANGLE + 90);
  const arcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  const circumference = 2 * Math.PI * r;
  const dashFraction = (score / 100) * (240 / 360);

  const colorZones = [
    { color: "#ef4444", label: "Risk-Off", range: [0, 33] },
    { color: "#eab308", label: "Neutral", range: [33, 66] },
    { color: "#10b981", label: "Risk-On", range: [66, 100] },
  ];

  const getColor = (s: number) => {
    if (s < 33) return "#ef4444";
    if (s < 66) return "#eab308";
    return "#10b981";
  };

  const needleAngle = angle + 90;
  const needleTip = polarToXY(angle + 90);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 180 130" className="w-full max-w-[220px]">
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Colored progress arc */}
        <motion.path
          d={arcPath}
          fill="none"
          stroke={getColor(score)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - dashFraction) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${getColor(score)}80)` }}
        />

        {/* Zone ticks */}
        {colorZones.map((zone) => {
          const midPct = (zone.range[0] + zone.range[1]) / 2;
          const tickAngle = MIN_ANGLE + (midPct / 100) * (MAX_ANGLE - MIN_ANGLE) + 90;
          const inner = { x: cx + (r - 14) * Math.cos((tickAngle * Math.PI) / 180), y: cy + (r - 14) * Math.sin((tickAngle * Math.PI) / 180) };
          const outer = { x: cx + (r - 4) * Math.cos((tickAngle * Math.PI) / 180), y: cy + (r - 4) * Math.sin((tickAngle * Math.PI) / 180) };
          return (
            <line key={zone.label} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={zone.color} strokeWidth="2" opacity="0.5" />
          );
        })}

        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ rotate: MIN_ANGLE + 90 }}
          animate={{ rotate: needleAngle }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
        <circle cx={cx} cy={cy} r={4} fill="white" opacity="0.8" />

        {/* Score text */}
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="20" fontWeight="bold" fill="white">
          {score}
        </text>
        <text x={cx} y={cy + 36} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">
          / 100
        </text>
      </svg>

      {/* Regime label */}
      <div className="text-center">
        <div
          className="text-sm font-bold"
          style={{ color: getColor(score) }}
        >
          {score < 33 ? "Risk-Off" : score < 66 ? "Neutral" : "Risk-On"}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
      </div>
    </div>
  );
}
