"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CandlestickChart,
  Repeat,
  Search,
  Wallet,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const STEPS = [
  {
    id: "research",
    title: "Research",
    desc: "AI reads SoSoValue, macro, and live market data for any asset.",
    href: "/research",
    icon: Search,
    x: 90,
  },
  {
    id: "signals",
    title: "Signals",
    desc: "Evidence-backed direction, confidence, and an invalidation thesis.",
    href: "/signals",
    icon: Zap,
    x: 330,
  },
  {
    id: "trade",
    title: "Trade",
    desc: "Sign orders on SoDEX mainnet with a preflight risk check and a $100 notional cap.",
    href: "/trade",
    icon: CandlestickChart,
    x: 570,
  },
  {
    id: "portfolio",
    title: "Portfolio",
    desc: "Real balances, fills, and exposure pulled from SoDEX mainnet.",
    href: "/portfolio",
    icon: Wallet,
    x: 810,
  },
];

const VIEW_W = 900;
const VIEW_H = 260;
const ROW_Y = 78;

const FORWARD_PATH = `M ${STEPS[0].x} ${ROW_Y} C 170 ${ROW_Y}, 250 ${ROW_Y}, ${STEPS[1].x} ${ROW_Y} C 410 ${ROW_Y}, 490 ${ROW_Y}, ${STEPS[2].x} ${ROW_Y} C 650 ${ROW_Y}, 730 ${ROW_Y}, ${STEPS[3].x} ${ROW_Y}`;

const RETURN_PATH = `M ${STEPS[3].x} ${ROW_Y} C 875 130, 860 205, 780 212 C 620 226, 340 226, 150 212 C 70 206, 55 150, ${STEPS[0].x} ${ROW_Y + 2}`;

const LOOP_PATH = `${FORWARD_PATH} ${RETURN_PATH.replace(/^M [\d.]+ [\d.]+/, "L")} Z`;

function pct(x: number, total: number) {
  return `${((x / total) * 100).toFixed(2)}%`;
}

export function ProductJourney() {
  const reduceMotion = useReducedMotion();
  const gradId = useId();

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard padding="lg" animate={false}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2
                className="text-xl font-black text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
              >
                How SoSoMind works
              </h2>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                </span>
                Mainnet
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl">
              One continuous loop: understand the market, act on evidence, then monitor execution.
              Every step reads live APIs and feeds the next research cycle. Nothing here is demo data.
            </p>
          </div>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:gap-2 transition-all"
          >
            Full docs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Desktop: animated loop diagram */}
        <div className="hidden lg:block relative h-[240px] mb-6">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full" aria-hidden preserveAspectRatio="none">
            <defs>
              <linearGradient id={`${gradId}-fwd`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(249,115,22,0.15)" />
                <stop offset="50%" stopColor="rgba(249,115,22,0.85)" />
                <stop offset="100%" stopColor="rgba(249,115,22,0.15)" />
              </linearGradient>
              <radialGradient id={`${gradId}-dot`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </radialGradient>
              <filter id={`${gradId}-glow`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <marker id={`${gradId}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.75)" />
            </marker>

            {/* Feedback return arc: portfolio monitoring informs the next research cycle */}
            <motion.path
              d={RETURN_PATH}
              fill="none"
              stroke="rgba(148,163,184,0.45)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 7"
              markerEnd={`url(#${gradId}-arrow)`}
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Primary forward flow */}
            <motion.path
              d={FORWARD_PATH}
              fill="none"
              stroke={`url(#${gradId}-fwd)`}
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.3 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Traveling data packets: the loop never stops */}
            {!reduceMotion && (
              <>
                <circle r="5" fill={`url(#${gradId}-dot)`} filter={`url(#${gradId}-glow)`}>
                  <animateMotion dur="6s" repeatCount="indefinite" path={LOOP_PATH} rotate="auto" />
                </circle>
                <circle r="3.5" fill="#fed7aa" filter={`url(#${gradId}-glow)`}>
                  <animateMotion dur="6s" repeatCount="indefinite" begin="3s" path={LOOP_PATH} rotate="auto" />
                </circle>
              </>
            )}
          </svg>

          {/* Icon nodes, positioned to match the SVG coordinates above */}
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                style={{ left: pct(step.x, VIEW_W), top: pct(ROW_Y, VIEW_H) }}
              >
                <div className="relative">
                  {!reduceMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ background: "rgba(249,115,22,0.35)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                    />
                  )}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-14 h-14 rounded-full flex items-center justify-center border-2"
                    style={{
                      background: "radial-gradient(circle at 30% 30%, rgba(30,20,10,0.95), rgba(10,8,6,0.98))",
                      borderColor: "rgba(249,115,22,0.55)",
                      boxShadow: "0 0 24px rgba(249,115,22,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#f97316" }} />
                    <span
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: "#f97316", color: "#0a0806" }}
                    >
                      {i + 1}
                    </span>
                  </motion.div>
                </div>
                <span className="text-[11px] font-bold text-[var(--text-primary)] whitespace-nowrap">{step.title}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical stepper with a flowing connector */}
        <div className="lg:hidden relative mb-6 pl-6">
          <div className="absolute left-[27px] top-6 bottom-6 w-px" style={{ background: "linear-gradient(to bottom, rgba(249,115,22,0.6), rgba(249,115,22,0.15))" }} />
          <div className="flex flex-col gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="relative w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center border-2"
                    style={{ background: "rgba(10,8,6,0.9)", borderColor: "rgba(249,115,22,0.5)" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "#f97316" }} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{step.title}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-[var(--text-muted)]">
            <Repeat className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Portfolio results feed straight back into the next research cycle.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={step.href}
                  className="group block h-full p-4 rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--bg-glass)] transition-all duration-300 hover:border-[var(--accent-border)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">Step {i + 1}</span>
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-1.5">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>SSI sectors and macro regime feed into every signal before you trade.</span>
        </div>
      </GlassCard>
    </motion.section>
  );
}
