"use client";
import { motion, type Variants } from "framer-motion";
import {
  Brain, TrendingUp, Target, Activity, ShieldCheck, Zap,
  BarChart3, DollarSign, Globe2, CheckCircle2, ArrowRight,
} from "lucide-react";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────
// Colors: var(--accent), var(--green), var(--yellow), var(--red), var(--text-primary), etc.

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 },
  }),
};

function SectionHeader({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div className="mb-8">
      <div
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3"
        style={{ background: "rgba(0,255,127,0.08)", border: "1px solid rgba(0,255,127,0.2)", color: "#00ff7f" }}
      >
        {label}
      </div>
      <h2
        className="text-2xl font-black tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
      >
        {title}
      </h2>
      <p className="text-sm max-w-2xl" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
        {sub}
      </p>
    </div>
  );
}

function FormulaBlock({ formula }: { formula: string }) {
  return (
    <pre
      className="px-4 py-3 rounded-xl text-sm overflow-x-auto"
      style={{
        background: "rgba(0,255,127,0.04)",
        border: "1px solid rgba(0,255,127,0.15)",
        color: "#00ff7f",
        fontFamily: "var(--font-mono)",
        lineHeight: 1.8,
      }}
    >
      {formula}
    </pre>
  );
}

function Chip({
  label, color, bg, border,
}: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {label}
    </span>
  );
}

// ─── Signal Layer Card ────────────────────────────────────────────────────────
function LayerCard({
  num, name, weight, icon, description, points, formula, i,
}: {
  num: number; name: string; weight: string; icon: React.ReactNode;
  description: string; points: string[]; formula: string; i: number;
}) {
  return (
    <motion.div
      custom={i}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      className="rounded-2xl p-6"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,255,127,0.1)", color: "#00ff7f" }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Layer {num}
            </span>
            <span
              className="text-[11px] font-black px-2 py-0.5 rounded-full"
              style={{ background: "rgba(0,255,127,0.1)", color: "#00ff7f" }}
            >
              {weight}
            </span>
          </div>
          <h3 className="text-base font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {name}
          </h3>
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
        {description}
      </p>

      <ul className="space-y-1.5 mb-4">
        {points.map((p, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#00ff7f" }} />
            {p}
          </li>
        ))}
      </ul>

      <FormulaBlock formula={formula} />
    </motion.div>
  );
}

// ─── Verdict Table ────────────────────────────────────────────────────────────
const VERDICTS = [
  { label: "STRONG BUY", range: "≥ 75", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", desc: "All 3 layers align. Highest-conviction entry." },
  { label: "BUY",        range: "55 – 74", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)", desc: "Strong composite score. Sector is trending." },
  { label: "NEUTRAL",    range: "35 – 54", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", desc: "Mixed signals. Monitor before committing." },
  { label: "SELL",       range: "< 35",  color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", desc: "Negative convergence across layers." },
];

// ─── Outcome Rules ────────────────────────────────────────────────────────────
const OUTCOMES = [
  {
    badge: "HIT",
    color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)",
    rule: "Price reaches Take Profit within 72 hours",
    detail: "LONG: close ≥ TP × 0.995  |  SHORT: close ≤ TP × 1.005",
  },
  {
    badge: "STOP",
    color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)",
    rule: "Price hits Stop Loss before Take Profit within 72 hours",
    detail: "LONG: close ≤ SL × 1.005  |  SHORT: close ≥ SL × 0.995",
  },
  {
    badge: "DRIFT",
    color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)",
    rule: "Signal expires at 72 hours without hitting TP or SL",
    detail: "Evaluated hourly by the outcome evaluator cron job",
  },
];

// ─── AI Providers ─────────────────────────────────────────────────────────────
const AI_CHAIN = [
  { name: "Cerebras",    role: "Primary inference — ultra-low latency",    latency: "~80ms" },
  { name: "SambaNova",   role: "Fallback #1 — structured outputs",         latency: "~200ms" },
  { name: "Together AI", role: "Fallback #2 — open-weight models",         latency: "~400ms" },
  { name: "OpenRouter",  role: "Fallback #3 — model routing",              latency: "~600ms" },
  { name: "Groq",        role: "Fallback #4 — Llama ultra-fast",           latency: "~150ms" },
  { name: "Gemini",      role: "Fallback #5 — multimodal research",        latency: "~800ms" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto pb-16 px-2">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 pt-4"
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-4"
          style={{ background: "rgba(0,255,127,0.08)", border: "1px solid rgba(0,255,127,0.2)", color: "#00ff7f" }}
        >
          <Brain className="w-3 h-3" />
          Signal Intelligence
        </div>
        <h1
          className="font-black mb-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
          }}
        >
          How the Platform<br />
          <span style={{ color: "#00ff7f" }}>Scores Markets</span>
        </h1>
        <p
          className="text-base max-w-2xl"
          style={{ color: "var(--text-muted)", lineHeight: 1.75 }}
        >
          Every signal, verdict, and sector score is produced by a deterministic three-layer convergence engine
          fed entirely by live on-chain and institutional data — no guesses, no mocks.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Chip label="13 SSI Sectors" color="#00ff7f" bg="rgba(0,255,127,0.08)" border="rgba(0,255,127,0.2)" />
          <Chip label="6-Provider AI Chain" color="#3b82f6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.2)" />
          <Chip label="Hourly Outcome Eval" color="#a78bfa" bg="rgba(167,139,250,0.08)" border="rgba(167,139,250,0.2)" />
          <Chip label="SoDEX EIP-712 Execution" color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" />
        </div>
      </motion.div>

      {/* Trust model */}
      <section className="mb-14">
        <SectionHeader
          label="00 — Trust Model"
          title="Custody & Signing Paths"
          sub="Honest disclosure for judges — dashboard relay is non-custodial; Telegram uses hosted signing on server decrypt."
        />
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--glass-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--glass-bg)" }}>
                {["Path", "Custody", "Signing", "Audit"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Dashboard relay", "Non-custodial", "MetaMask EIP-712", "signed_orders"],
                ["Telegram bot", "Hosted", "Server decrypt on confirm", "Chat log + order ID"],
                ["MCP / API house", "Operator", "Env SODEX_PRIVATE_KEY", "Disabled in public deploy"],
              ].map(([path, custody, signing, audit]) => (
                <tr key={path} className="border-t" style={{ borderColor: "var(--glass-border)" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{path}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{custody}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{signing}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{audit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 1: Sector Intelligence ── */}
      <section className="mb-14">
        <SectionHeader
          label="01 — Sector Scoring"
          title="Three-Layer Convergence Engine"
          sub="All 13 SSI sectors are independently scored on three orthogonal data signals. The final composite score is a weighted sum refreshed every 5 minutes via Upstash Redis."
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <FormulaBlock
            formula={
              "CompositeScore = (Signal1 × 0.30) + (Signal2 × 0.35) + (Signal3 × 0.35)\n\n" +
              "  Signal1  =  Fundraising capital velocity   (0 – 100)\n" +
              "  Signal2  =  Institutional momentum index    (0 – 100)\n" +
              "  Signal3  =  ETF flow health ratio           (0 – 100)"
            }
          />
        </motion.div>

        <div className="grid gap-5">
          <LayerCard
            i={0}
            num={1}
            name="Fundraising Capital Velocity"
            weight="30%"
            icon={<DollarSign className="w-5 h-5" />}
            description="Measures how aggressively venture capital is flowing into a sector. Large raises and high frequency of rounds in the past 30 days indicate smart-money conviction."
            points={[
              "Amount score: $50M+ raised in sector → max 50 pts (logarithmic scale)",
              "Count score: 5+ rounds in 30 days → max 50 pts (linear, 10 pts/round)",
              "Data source: SoSoValue Fundraising Projects API (real-time, last 30 days)",
            ]}
            formula={"amount_score = min(50, log10(total_raised / 1e6 + 1) × 25)\n" +
              "count_score  = min(50, round_count × 10)\n" +
              "Signal1      = amount_score + count_score"}
          />

          <LayerCard
            i={1}
            num={2}
            name="Institutional Momentum Index"
            weight="35%"
            icon={<TrendingUp className="w-5 h-5" />}
            description="Tracks smart-money accumulation via BTC treasury purchases and crypto-adjacent equity performance. Corporate buying and positive stock momentum both signal institutional risk-on."
            points={[
              "BTC score: 5,000+ BTC purchased by corporate treasuries → 50 pts (per 1,000 BTC block)",
              "Stock score: 10%+ average crypto stock gain (7d) → 50 pts (5 pts per 1%)",
              "Sources: SoSoValue BTC Treasuries API + Crypto Stock Snapshot API",
            ]}
            formula={"btc_score   = min(50, round(btc_purchased / 1000) × 10)\n" +
              "stock_score = min(50, max(0, avg_stock_change% × 5))\n" +
              "Signal2     = btc_score + stock_score"}
          />

          <LayerCard
            i={2}
            num={3}
            name="ETF Flow Health Ratio"
            weight="35%"
            icon={<BarChart3 className="w-5 h-5" />}
            description="Quantifies institutional demand via Bitcoin and Ethereum spot ETF flow momentum. The 7d/30d inflow ratio detects acceleration vs deceleration of institutional buying."
            points={[
              "Flow ratio = 7-day net inflow ÷ 30-day average daily inflow",
              "Ratio ≥ 2.0 → max score (institutional acceleration)",
              "Ratio ≤ 0 → zero score (net outflows indicate risk-off)",
              "Data source: SoSoValue ETF History API (BTC + ETH spot ETFs)",
            ]}
            formula={"flow_ratio = net_inflow_7d / (net_inflow_30d / 30)\n" +
              "Signal3    = min(100, max(0, flow_ratio × 50))"}
          />
        </div>
      </section>

      {/* ── Section 2: Verdict Thresholds ── */}
      <section className="mb-14">
        <SectionHeader
          label="02 — Verdicts"
          title="Score → Signal Mapping"
          sub="Each sector receives a final verdict based on its composite score. Verdicts are deterministic — the same inputs always produce the same verdict, enabling backtesting and auditability."
        />
        <div className="grid sm:grid-cols-2 gap-4">
          {VERDICTS.map((v, i) => (
            <motion.div
              key={v.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="rounded-xl px-5 py-4"
              style={{ background: v.bg, border: `1px solid ${v.border}` }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="text-sm font-black tracking-wider"
                  style={{ color: v.color, fontFamily: "var(--font-mono)" }}
                >
                  {v.label}
                </span>
                <span
                  className="ml-auto text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: v.bg, border: `1px solid ${v.border}`, color: v.color, fontFamily: "var(--font-mono)" }}
                >
                  {v.range}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Signal Outcome Evaluation ── */}
      <section className="mb-14">
        <SectionHeader
          label="03 — Outcome Tracking"
          title="Hourly Signal Resolution"
          sub="Every directional signal is evaluated hourly against live Binance price data. Outcomes are recorded permanently in Supabase, enabling a verifiable and tamper-evident public track record."
        />

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {OUTCOMES.map((o, i) => (
            <motion.div
              key={o.badge}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="rounded-xl px-5 py-4"
              style={{ background: o.bg, border: `1px solid ${o.border}` }}
            >
              <div
                className="text-base font-black mb-2"
                style={{ color: o.color, fontFamily: "var(--font-mono)" }}
              >
                {o.badge}
              </div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{o.rule}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{o.detail}</p>
            </motion.div>
          ))}
        </div>

        <FormulaBlock
          formula={
            "Evaluation window: 72 hours from signal.created_at\n" +
            "Cron schedule:     Every hour  (outcome-evaluator.ts)\n\n" +
            "HIT  →  LONG:  close_price ≥ take_profit × 0.995\n" +
            "         SHORT: close_price ≤ take_profit × 1.005\n\n" +
            "STOP →  LONG:  close_price ≤ stop_loss × 1.005\n" +
            "         SHORT: close_price ≥ stop_loss × 0.995\n\n" +
            "DRIFT → Neither TP nor SL reached within 72h window"
          }
        />

        <div
          className="mt-4 rounded-xl px-5 py-4 text-sm"
          style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "var(--text-muted)", lineHeight: 1.7 }}
        >
          <span className="font-bold" style={{ color: "#a78bfa" }}>Track Record Score</span> — Aggregated as:
          hit rate (%), total evaluated, and average return (%). Stored in{" "}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#a78bfa" }}>
            agent_meta
          </code>{" "}
          key-value store and surfaced in the bot via{" "}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#a78bfa" }}>
            /track_record
          </code>.
        </div>
      </section>

      {/* ── Section 4: AI Reasoning Chain ── */}
      <section className="mb-14">
        <SectionHeader
          label="04 — AI Reasoning"
          title="Six-Provider Fallback Chain"
          sub="Sector narratives and signal reasoning are generated by a cascading AI chain. If the primary provider fails or rate-limits, the next provider is tried automatically — ensuring zero narrative blackouts."
        />
        <div className="grid gap-3">
          {AI_CHAIN.map((p, i) => (
            <motion.div
              key={p.name}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-30px" }}
              variants={fadeUp}
              className="flex items-center gap-4 rounded-xl px-5 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black"
                style={{ background: "rgba(0,255,127,0.08)", color: "#00ff7f", fontFamily: "var(--font-mono)" }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{p.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.role}</div>
              </div>
              <div
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,255,127,0.06)", color: "#00ff7f", fontFamily: "var(--font-mono)" }}
              >
                {p.latency}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 5: SoDEX Execution ── */}
      <section className="mb-14">
        <SectionHeader
          label="05 — Trade Execution"
          title="Non-Custodial EIP-712 Trading"
          sub="Signals feed directly into the SoDEX execution wizard. All orders are signed client-side with EIP-712 typed data — the platform never holds private keys."
        />
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            {
              icon: <ShieldCheck className="w-4 h-4" />,
              title: "Non-Custodial",
              desc: "Private keys never leave your device. Orders are signed with EIP-712 typed data and submitted directly to SoDEX smart contracts on chainId=138565.",
            },
            {
              icon: <Zap className="w-4 h-4" />,
              title: "4-Step Wizard",
              desc: "Confirm parameters → Sign EIP-712 → Submit to relayer → Execution proof. Every step is atomic and the hash is shown on completion.",
            },
            {
              icon: <Activity className="w-4 h-4" />,
              title: "My Edge Analytics",
              desc: "Enter any EVM address to analyze its complete trade history on SoDEX: win rate, peak-hour heatmap, market-by-market P&L, and an AI one-sentence edge summary.",
            },
            {
              icon: <Globe2 className="w-4 h-4" />,
              title: "MCP Integration",
              desc: "18 SoDEX tools are exposed via the MCP server (packages/mcp-sodex). AI agents can place, cancel, and monitor orders via structured tool calls.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="rounded-xl px-5 py-4"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(0,255,127,0.08)", color: "#00ff7f" }}
                >
                  {item.icon}
                </div>
                <span className="text-sm font-bold">{item.title}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      {/* ── Trust Model (Wave 2) ── */}
      <section className="mb-14">
        <SectionHeader
          label="06 — Trust Model"
          title="Custody & Audit Paths"
          sub="Two signing models — both disclosed. Dashboard is non-custodial; Telegram uses hosted encrypted signing."
        />
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--glass-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--glass-bg)" }}>
                {["Path", "Custody", "Signing", "Audit"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-[var(--text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Dashboard relay", "Non-custodial", "MetaMask in browser", "signed_orders table"],
                ["Telegram bot", "Hosted wallet", "Server decrypt on confirm", "SoDEX order ID + chat log"],
                ["House API", "Disabled public", "Env operator key only", "Gated by ADMIN_API_KEY"],
              ].map(([a, b, c, d]) => (
                <tr key={a} className="border-t" style={{ borderColor: "var(--glass-border)" }}>
                  <td className="px-4 py-3 font-semibold">{a}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{b}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="rounded-2xl px-8 py-8 text-center"
        style={{ background: "rgba(0,255,127,0.04)", border: "1px solid rgba(0,255,127,0.15)" }}
      >
        <h3 className="text-xl font-black mb-2 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          5-minute judge path
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
          Track Record → Signal audit → Risk preflight → MetaMask sign → Portfolio proof
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/track-record" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#00ff7f", color: "#030a05" }}>
            View Track Record
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/trade" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
            Trade on SoDEX
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
