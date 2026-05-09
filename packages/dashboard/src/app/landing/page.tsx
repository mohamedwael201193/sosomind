"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { GlassCard } from "@/components/GlassCard";
import {
  Zap, BarChart3, Shield, TrendingUp, Brain, Globe2, ArrowRight, Wallet,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Agentic AI",
    desc: "Multi-agent orchestration analyzes macro regimes, sectors, and risk in real time.",
  },
  {
    icon: TrendingUp,
    title: "Signal Engine",
    desc: "High-confidence long/short signals powered by SoSoValue data and on-chain analytics.",
  },
  {
    icon: Globe2,
    title: "Macro Overlay",
    desc: "Track global macro events, ETF flows, and institutional positioning with a single gauge.",
  },
  {
    icon: BarChart3,
    title: "Sector Heatmap",
    desc: "Visualize crypto sector rotation and spot momentum shifts before the market moves.",
  },
  {
    icon: Shield,
    title: "Risk Monitor",
    desc: "Dynamic circuit-breakers and position sizing keep drawdowns within target limits.",
  },
  {
    icon: Zap,
    title: "DEX Integration",
    desc: "Execute spot and perpetuals directly on SoDEX with one-click from the dashboard.",
  },
];

const stats = [
  { label: "Assets Tracked", value: "2,400+" },
  { label: "Signals Generated", value: "18K+" },
  { label: "Avg Win Rate", value: "67%" },
  { label: "Data Sources", value: "12" },
];

export default function LandingPage() {
  const { address, isConnecting, connect } = useWallet();

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-card)] backdrop-blur-xl mb-8 text-sm text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            Live · AI-Powered Finance Intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            The Agentic Finance
            <br />
            <span
              className="bg-gradient-to-r from-[var(--blue)] via-[var(--purple)] to-[var(--green)] bg-clip-text text-transparent"
            >
              Operating System
            </span>
          </h1>

          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10">
            SosoMind combines multi-agent AI, real-time market data, and DEX execution into a
            single unified platform — built for serious crypto traders.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {address ? (
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-[var(--radius-lg)] font-bold text-white"
                  style={{ background: "var(--grad-brand)" }}
                >
                  Open Dashboard <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-8 py-4 rounded-[var(--radius-lg)] font-bold text-white disabled:opacity-60"
                style={{ background: "var(--grad-brand)" }}
              >
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </motion.button>
            )}
            <Link href="/research">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-8 py-4 rounded-[var(--radius-lg)] font-bold border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--bg-glass-hover)] transition-colors"
              >
                Explore Research <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="py-8 border-y border-[var(--glass-border)]">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className="text-3xl font-black bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-16">
            Everything you need to trade smarter
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <GlassCard key={f.title} animate padding="lg">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--blue-soft)] to-[var(--purple-soft)] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[var(--blue)]" />
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-2">{f.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{f.desc}</p>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <GlassCard glow="blue" padding="lg" className="text-center">
            <h2 className="text-3xl font-black mb-4">Ready to get started?</h2>
            <p className="text-[var(--text-secondary)] mb-8">
              Connect your wallet and access the full SosoMind dashboard instantly.
            </p>
            {address ? (
              <Link href="/">
                <button
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-[var(--radius-lg)] font-bold text-white"
                  style={{ background: "var(--grad-brand)" }}
                >
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-[var(--radius-lg)] font-bold text-white disabled:opacity-60"
                style={{ background: "var(--grad-brand)" }}
              >
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </GlassCard>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-[var(--text-muted)]">
        © {new Date().getFullYear()} SosoMind · Agentic Finance Intelligence
      </footer>
    </main>
  );
}
