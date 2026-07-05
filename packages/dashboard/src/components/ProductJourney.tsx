"use client";

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CandlestickChart, Search, Wallet, Zap } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const STEPS = [
  {
    id: "research",
    title: "Research",
    desc: "AI reads SoSoValue, macro, and live market data for any asset.",
    href: "/research",
    icon: Search,
    x: 80,
    y: 40,
  },
  {
    id: "signals",
    title: "Signals",
    desc: "Evidence-backed direction, confidence, and invalidation thesis.",
    href: "/signals",
    icon: Zap,
    x: 280,
    y: 40,
  },
  {
    id: "trade",
    title: "Trade",
    desc: "Sign orders on SoDEX with preflight risk checks.",
    href: "/trade",
    icon: CandlestickChart,
    x: 480,
    y: 40,
  },
  {
    id: "portfolio",
    title: "Portfolio",
    desc: "Real balances, fills, and exposure from SoDEX mainnet.",
    href: "/portfolio",
    icon: Wallet,
    x: 680,
    y: 40,
  },
];

export function ProductJourney() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard padding="lg" animate={false}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2
              className="text-xl font-black text-[var(--text-primary)] mb-2"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
            >
              How SoSoMind works
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl">
              One loop: understand the market, act on evidence, monitor execution. Every step uses live APIs, not demo data.
            </p>
          </div>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:gap-2 transition-all"
          >
            Full docs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="hidden lg:block relative h-[200px] mb-6">
          <svg viewBox="0 0 760 120" className="w-full h-full" aria-hidden>
            <defs>
              <linearGradient id="journeyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(249,115,22,0.2)" />
                <stop offset="50%" stopColor="rgba(249,115,22,0.6)" />
                <stop offset="100%" stopColor="rgba(249,115,22,0.2)" />
              </linearGradient>
            </defs>
            <motion.path
              d="M 120 60 C 200 60, 200 60, 280 60 S 360 60, 440 60 S 520 60, 600 60"
              fill="none"
              stroke="url(#journeyGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.3 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
            {STEPS.map((step, i) => (
              <g key={step.id}>
                <motion.circle
                  cx={120 + i * 160}
                  cy={60}
                  r={28}
                  fill="rgba(14,14,16,0.9)"
                  stroke="rgba(249,115,22,0.45)"
                  strokeWidth="1.5"
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.text
                  x={120 + i * 160}
                  y={64}
                  textAnchor="middle"
                  fill="#f97316"
                  fontSize="11"
                  fontWeight="700"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35 + i * 0.12 }}
                >
                  {i + 1}
                </motion.text>
              </g>
            ))}
          </svg>
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
