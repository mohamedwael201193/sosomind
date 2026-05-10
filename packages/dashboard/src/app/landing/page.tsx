"use client";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import {
  Zap, BarChart3, Shield, TrendingUp, Brain, Globe2, ArrowRight, Wallet,
  Mic, RefreshCcw, Search, Eye, BookOpen, Scale, FileText, Swords, User, DollarSign,
  ChevronDown, Sun, Moon, Send, Database, Activity, Layers, Target,
  Network, Cpu, MessageSquare, Star, Check, Bolt,
  X, Code2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import MCP from "@lobehub/icons/es/MCP";
import Claude from "@lobehub/icons/es/Claude";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Gemini from "@lobehub/icons/es/Gemini";
import DeepSeek from "@lobehub/icons/es/DeepSeek";
import Mistral from "@lobehub/icons/es/Mistral";

// ── Types ─────────────────────────────────────────────────────────────────────
type Theme = "dark" | "light";

// ── Constants ──────────────────────────────────────────────────────────────────

const HERO_TAGLINE = "The Agentic Finance OS";
const HERO_SUB = "Multi-agent AI research, real-time signals, and DEX execution — built for serious crypto traders.";
const NAV_LINKS = ["Features", "Agents", "Data", "Bot", "FAQ"];

const STATS = [
  { value: "2,400+", label: "Assets Tracked" },
  { value: "18K+",   label: "Signals Generated" },
  { value: "15",     label: "AI Agents" },
  { value: "13",     label: "Data Sources" },
  { value: "67%",    label: "Signal Win Rate" },
];

const PARTNERS = [
  "SoSoValue", "SoDEX", "Binance", "Macro Events", "Fundraising DB", "On-chain Analytics",
  "ETF Flows", "Sector Indices", "BTC Treasuries", "Social Sentiment", "Crypto Stocks", "News Feed", "NFT Data",
];

const FEATURES = [
  { icon: MessageSquare, title: "NLP Intent Trading",      desc: "Type in plain English, execute with precision. Our NLP agent parses your intent and routes it to the right strategy.",  size: "large"  },
  { icon: Zap,           title: "Signal Marketplace",      desc: "Subscribe to curated signal streams from top-performing strategies, each verified with live backtest performance.",      size: "large"  },
  { icon: Search,        title: "Arbitrage Scanner",       desc: "Real-time cross-exchange spread detection with slippage-adjusted execution paths.",                                     size: "medium" },
  { icon: Eye,           title: "Whale Tracker",           desc: "Follow on-chain wallet movements of known large traders with entry/exit alerts.",                                        size: "medium" },
  { icon: Mic,           title: "Voice Trading",           desc: "Hands-free trading via voice commands. Powered by Whisper AI and integrated directly into SoDEX execution.",            size: "medium" },
  { icon: RefreshCcw,    title: "Portfolio Rebalancer",    desc: "Set target allocations and auto-rebalance on schedule or on drift thresholds.",                                          size: "small"  },
  { icon: Activity,      title: "Paper Trading",           desc: "Test strategies in live market conditions with zero risk on our full paper trading simulator.",                           size: "small"  },
  { icon: Layers,        title: "Confluence Engine",       desc: "Combine signals from 5+ independent systems for high-confidence trade ideas.",                                          size: "small"  },
  { icon: Scale,         title: "Kelly Criterion",         desc: "Mathematically optimal position sizing based on your edge and risk tolerance.",                                          size: "small"  },
  { icon: Star,          title: "Social Sentiment",        desc: "Aggregate Twitter/X, Telegram, and Reddit sentiment into actionable momentum signals.",                                  size: "small"  },
  { icon: FileText,      title: "Tax Reporting",           desc: "Auto-generate capital gains reports, FIFO accounting, and export for TurboTax or CoinTracker.",                         size: "small"  },
  { icon: Swords,        title: "MEV Protection",          desc: "Route orders through MEV-resistant RPC endpoints and private mempool submissions.",                                      size: "small"  },
  { icon: User,          title: "Trader Persona",          desc: "AI-built risk profile calibrated to your trading history, drawdown tolerance, and return goals.",                       size: "small"  },
  { icon: DollarSign,    title: "Funding Signals",         desc: "Monitor perpetual funding rates across exchanges for long/short bias arbitrage opportunities.",                          size: "small"  },
  { icon: BookOpen,      title: "Macro Playbook",          desc: "Regime-aware strategy selection based on ETF flows, macro events, and institutional positioning.",                      size: "small"  },
];

const AGENTS = [
  { name: "Orchestrator",  icon: Network,  desc: "Central coordination hub that routes user intent to the right specialist agent, enforces circuit breakers, and aggregates final recommendations.", confidence: 94 },
  { name: "Research",      icon: Brain,    desc: "Deep-dives into asset fundamentals, tokenomics, fundraising history, and community metrics to build comprehensive investment theses.", confidence: 88 },
  { name: "Risk",          icon: Shield,   desc: "Continuously monitors portfolio exposure, correlation matrices, and macro stress indicators to trigger defensive actions.", confidence: 91 },
  { name: "Macro Overlay", icon: Globe2,   desc: "Tracks ETF flows, macro events, Fed policy cycles, and cross-asset signals to contextualize every trade in the macro landscape.", confidence: 85 },
  { name: "Execution",     icon: Bolt,     desc: "Handles order routing, slippage optimization, MEV protection, and multi-leg spread execution directly on SoDEX.", confidence: 97 },
];

const SIGNALS = [
  { pair: "BTC/USDT", direction: "LONG",    confidence: 82, data: [62000,63100,63800,62900,64200,65100,64800,66200] },
  { pair: "ETH/USDT", direction: "NEUTRAL", confidence: 54, data: [2400,2350,2380,2410,2390,2430,2420,2450] },
  { pair: "SOL/USDT", direction: "LONG",    confidence: 76, data: [148,151,149,155,158,157,162,165] },
  { pair: "BNB/USDT", direction: "SHORT",   confidence: 71, data: [580,572,568,574,566,560,555,548] },
];

const ETF_DATA = [
  { date: "Jan 1",  inflow: 420, outflow: 210 },
  { date: "Jan 2",  inflow: 380, outflow: 190 },
  { date: "Jan 3",  inflow: 510, outflow: 240 },
  { date: "Jan 4",  inflow: 460, outflow: 280 },
  { date: "Jan 5",  inflow: 620, outflow: 200 },
  { date: "Jan 6",  inflow: 580, outflow: 310 },
  { date: "Jan 7",  inflow: 700, outflow: 260 },
];

const MACRO_EVENTS = [
  { date: "Jan 8",  category: "FED",    title: "FOMC Meeting",                  impact: "HIGH"   },
  { date: "Jan 9",  category: "ETF",    title: "BlackRock BTC ETF: $420M flow", impact: "HIGH"   },
  { date: "Jan 11", category: "CPI",    title: "US CPI Print: 3.1%",            impact: "MEDIUM" },
  { date: "Jan 12", category: "CRYPTO", title: "Ethereum Dencun Upgrade",       impact: "HIGH"   },
  { date: "Jan 14", category: "MACRO",  title: "Non-Farm Payrolls",             impact: "MEDIUM" },
  { date: "Jan 15", category: "CRYPTO", title: "Coinbase Q4 Earnings",          impact: "LOW"    },
  { date: "Jan 16", category: "FED",    title: "Fed Chair Speech",              impact: "MEDIUM" },
  { date: "Jan 18", category: "ETF",    title: "Options expiry: $2.4B",         impact: "HIGH"   },
];

const DATA_SOURCES = [
  { name: "SoSoValue",          tools: 35, type: "MCP",  icon: Database    },
  { name: "SoDEX",              tools: 25, type: "MCP",  icon: Zap         },
  { name: "Binance Spot",       tools: 12, type: "REST", icon: Activity    },
  { name: "Binance Perps",      tools: 10, type: "REST", icon: TrendingUp  },
  { name: "Macro Events",       tools: 8,  type: "Feed", icon: Globe2      },
  { name: "Fundraising DB",     tools: 6,  type: "Feed", icon: DollarSign  },
  { name: "Social Sentiment",   tools: 5,  type: "AI",   icon: MessageSquare },
  { name: "On-chain Analytics", tools: 9,  type: "RPC",  icon: Layers      },
  { name: "ETF Flows",          tools: 7,  type: "Feed", icon: BarChart3   },
  { name: "Sector Indices",     tools: 8,  type: "Feed", icon: Target      },
  { name: "BTC Treasuries",     tools: 4,  type: "Feed", icon: BookOpen    },
  { name: "Crypto Stocks",      tools: 6,  type: "REST", icon: Star        },
  { name: "News Feed",          tools: 11, type: "AI",   icon: FileText    },
];

const LEADERBOARD = [
  { rank: 1, name: "alpha_sage",  returns: "+312%", signals: 248, winRate: "74%" },
  { rank: 2, name: "quant_node",  returns: "+187%", signals: 192, winRate: "69%" },
  { rank: 3, name: "whale_watch", returns: "+154%", signals: 310, winRate: "65%" },
];

const FAQ_ITEMS = [
  { q: "What is SoSoMind?",                a: "SoSoMind is a multi-agent AI-powered trading platform that combines real-time market intelligence, automated signals, and direct DEX execution into a single unified interface." },
  { q: "How do signals work?",             a: "Our Signal Engine aggregates data from 13 live sources, runs them through 5 specialist AI agents, and surfaces high-confidence directional signals with confluence scoring." },
  { q: "What is the Agent Orchestrator?",  a: "The Orchestrator is the central brain — it receives your intent, decides which specialist agents to activate, enforces risk limits, and assembles the final recommendation." },
  { q: "How does DEX execution work?",     a: "Type a natural language trade command or click execute on any signal. The NLP agent parses your intent, the Execution agent routes it to SoDEX, and you confirm with an EIP-712 signature." },
  { q: "Is paper trading available?",      a: "Yes. Toggle paper mode at any time to test strategies in live market conditions with simulated capital — no real funds at risk." },
  { q: "What data sources are used?",      a: "SoSoMind connects to 13 live data sources including SoSoValue (35 MCP tools), SoDEX (25 MCP tools), Binance, on-chain analytics, macro event calendars, and social sentiment feeds." },
  { q: "How does risk monitoring work?",   a: "The Risk Agent continuously tracks portfolio VaR, correlation, and drawdown. Circuit breakers automatically reduce exposure when thresholds are breached." },
  { q: "How do I get started?",            a: "Connect your MetaMask wallet from the landing page, complete a 2-minute Trader Persona quiz, and your personalized agent dashboard is ready instantly." },
];

// ── Micro-components ──────────────────────────────────────────────────────────

function SplitHeadline({ text, className }: { text: string; className?: string }) {
  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
  };
  const char = {
    hidden:  { opacity: 0, y: 28, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  };
  return (
    <motion.h1 className={className} variants={container} initial="hidden" animate="visible">
      {text.split("").map((c, i) => (
        <motion.span key={i} variants={char} style={{ display: "inline-block" }}>
          {c === " " ? "\u00A0" : c}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function SpotlightCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [pos, setPos] = useState({ x: 0, y: 0, opacity: 0 });
  return (
    <div
      className={`relative overflow-hidden rounded-[8px] border ${className}`}
      style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)", ...style }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, opacity: 1 });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, opacity: 0 }))}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: pos.opacity, background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, rgba(249,115,22,0.1), transparent 50%)` }}
      />
      {children}
    </div>
  );
}

function MagneticButton({ children, onClick, disabled, className = "", style }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 15 });
  const sy = useSpring(my, { stiffness: 200, damping: 15 });
  return (
    <motion.button
      style={{ x: sx, y: sy, ...style }}
      className={className}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left - r.width / 2) * 0.3);
        my.set((e.clientY - r.top - r.height / 2) * 0.3);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      {children}
    </motion.button>
  );
}

function SignalBadge({ dir }: { dir: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    LONG:    { background: "rgba(34,197,94,0.15)",  color: "#22c55e", borderColor: "rgba(34,197,94,0.3)"  },
    SHORT:   { background: "rgba(239,68,68,0.15)",  color: "#ef4444", borderColor: "rgba(239,68,68,0.3)"  },
    NEUTRAL: { background: "rgba(96,165,250,0.15)", color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)" },
  };
  return <span className="px-2 py-0.5 rounded text-xs font-bold border" style={styleMap[dir]}>{dir}</span>;
}

function ImpactBadge({ impact }: { impact: string }) {
  const map: Record<string, React.CSSProperties> = {
    HIGH:   { background: "rgba(249,115,22,0.15)",  color: "#f97316", borderColor: "rgba(249,115,22,0.3)"  },
    MEDIUM: { background: "rgba(250,204,21,0.12)",  color: "#eab308", borderColor: "rgba(250,204,21,0.25)" },
    LOW:    { background: "rgba(107,114,128,0.15)", color: "#6b7280", borderColor: "rgba(107,114,128,0.25)"},
  };
  return <span className="px-2 py-0.5 rounded text-xs font-bold border" style={map[impact]}>{impact}</span>;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { address, isConnecting, connect } = useWallet();
  const [theme, setTheme] = useState<Theme>("dark");
  const [activeAgent, setActiveAgent] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [execStep, setExecStep] = useState(-1);
  const execRef = useRef<HTMLDivElement | null>(null);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springX = useSpring(cursorX, { stiffness: 350, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 350, damping: 28 });

  useEffect(() => {
    const saved = localStorage.getItem("soso-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [cursorX, cursorY]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      localStorage.setItem("soso-theme", next);
      return next;
    });
  };

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveAgent((a) => (a + 1) % AGENTS.length), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = execRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let step = 0;
        const animate = () => { setExecStep(step); step++; if (step < 4) setTimeout(animate, 500); };
        setTimeout(animate, 300);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div data-theme={theme} className="min-h-screen overflow-x-hidden" style={{ background: "var(--bg-base)", color: "var(--text-primary)", cursor: "none" }}>

      {/* Noise overlay */}
      <div className="pointer-events-none fixed inset-0 z-[1] opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
      }} />

      {/* Custom cursor */}
      <motion.div
        style={{ x: springX, y: springY, translateX: "-50%", translateY: "-50%", mixBlendMode: "difference" as const }}
        className="fixed top-0 left-0 w-5 h-5 rounded-full pointer-events-none z-[9999]"
        css-bg={theme === "dark" ? "#ffffff" : "#111111"}
      >
        <div className="w-full h-full rounded-full" style={{ background: theme === "dark" ? "#ffffff" : "#111111" }} />
      </motion.div>

      {/* ── 1. NAVBAR ─────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-12 h-16"
        style={{
          background: navScrolled ? (theme === "dark" ? "rgba(8,9,16,0.92)" : "rgba(255,255,255,0.92)") : "transparent",
          backdropFilter: navScrolled ? "blur(20px)" : "none",
          borderBottom: navScrolled ? "1px solid var(--glass-border)" : "none",
          transition: "background 0.3s",
        }}
      >
        <div className="flex items-center gap-8">
          <Link href="/landing" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="SoSoMind"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
              priority
              style={{ filter: theme === "light" ? "brightness(0.1) saturate(0)" : "none" }}
            />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} className="text-sm font-medium transition-colors" style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)"; }}>
                {link}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://t.me/sosomind_bot" target="_blank" rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: "rgba(0,136,204,0.35)", color: "#0088cc", background: "rgba(0,136,204,0.08)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,136,204,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,136,204,0.08)"; }}>
            <Send className="w-3.5 h-3.5" /> Telegram
          </a>
          <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors"
            style={{ borderColor: "var(--glass-border)", color: "var(--text-secondary)", background: "transparent" }}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {address ? (
            <Link href="/">
              <button className="px-4 py-2 rounded-[20px] text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}>
                Dashboard
              </button>
            </Link>
          ) : (
            <button onClick={connect} disabled={isConnecting}
              className="px-4 py-2 rounded-[20px] text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}>
              {isConnecting ? "Connecting…" : "Launch Dashboard"}
            </button>
          )}
        </div>
      </motion.nav>

      {/* ── 2. HERO ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={{
            background: theme === "dark"
              ? "radial-gradient(ellipse at 60% 0%, rgba(249,115,22,0.25) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(249,115,22,0.12) 0%, transparent 50%), #080910"
              : "radial-gradient(ellipse at 60% 0%, rgba(249,115,22,0.1) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(249,115,22,0.05) 0%, transparent 50%), #ffffff",
          }} />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `radial-gradient(circle, ${theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)"} 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
            animation: "gridFloat 20s linear infinite",
          }} />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-10 text-sm font-medium"
              style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)", backdropFilter: "blur(16px)", color: "var(--text-secondary)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: "#22c55e" }} />
              Live · AI-Powered Finance Intelligence
            </div>
          </motion.div>

          <SplitHeadline
            text={HERO_TAGLINE}
            className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.95] tracking-[-0.04em] mb-6"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            className="text-[clamp(1.1rem,2.5vw,1.35rem)] max-w-2xl mx-auto mb-12 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {HERO_SUB}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            {address ? (
              <Link href="/">
                <MagneticButton
                  className="flex items-center gap-2 px-8 py-4 rounded-[20px] font-bold text-white text-base"
                  style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
                >
                  Open Dashboard <ArrowRight className="w-5 h-5" />
                </MagneticButton>
              </Link>
            ) : (
              <MagneticButton
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-8 py-4 rounded-[20px] font-bold text-white text-base disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
              >
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </MagneticButton>
            )}
            <Link href="/research">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-8 py-4 rounded-[20px] font-medium text-base border transition-colors"
                style={{ borderColor: "var(--glass-border)", color: "var(--text-primary)", background: "transparent" }}
              >
                Explore Research <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <a href="https://t.me/sosomind_bot" target="_blank" rel="noopener noreferrer">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-8 py-4 rounded-[20px] font-medium text-base border transition-colors"
                style={{ borderColor: "rgba(0,136,204,0.35)", color: "#0088cc", background: "rgba(0,136,204,0.07)" }}
              >
                <Send className="w-4 h-4" /> Open Telegram Bot
              </motion.button>
            </a>
          </motion.div>

          {/* Mini dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            className="mt-16 rounded-[12px] border overflow-hidden max-w-2xl mx-auto"
            style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)", backdropFilter: "blur(20px)" }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <div className="flex gap-1.5">
                {["#ef4444","#eab308","#22c55e"].map((c) => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              </div>
              <span className="text-xs ml-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>SoSoMind · Signal Engine</span>
            </div>
            <div className="p-4 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ETF_DATA}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="inflow" stroke="#f97316" fill="url(#heroGrad)" strokeWidth={2} dot={false} isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 3. PARTNERS MARQUEE + STATS ───────────────────────────────────── */}
      <section className="border-y overflow-hidden py-3" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex gap-12 whitespace-nowrap" style={{ animation: "marquee 25s linear infinite" }}>
          {[...PARTNERS, ...PARTNERS].map((p, i) => (
            <span key={i} className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{p}</span>
          ))}
        </div>
      </section>

      <section className="py-16 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
          {STATS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <div className="text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: "#f97316" }}>{s.value}</div>
              <div className="text-xs mt-1 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 4. ARCHITECTURE DIAGRAM ───────────────────────────────────────── */}
      <section id="agents" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>Architecture</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Agents working in concert</h2>
            <p className="text-center max-w-xl mx-auto mb-16" style={{ color: "var(--text-secondary)" }}>Specialist AI agents collaborate in real time — each with its own domain expertise, all coordinated by the Orchestrator.</p>
          </motion.div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
            {[
              { label: "13 Data Feeds",       sub: "SoSoValue · SoDEX · Binance", icon: Database },
              { label: "Agent Orchestrator",  sub: "NLP · Risk · Research · Macro", icon: Network },
              { label: "Signals & Execution", sub: "Trades · Alerts · Content",   icon: Zap },
            ].map((node, i) => {
              const Icon = node.icon;
              return (
                <div key={i} className="flex items-center gap-4 w-full md:w-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: i * 0.18, duration: 0.5 }}
                    className="flex-1 md:flex-none"
                  >
                    <SpotlightCard className="p-5 text-center" style={{ minWidth: 160 }}>
                      <div className="w-10 h-10 rounded-[8px] flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)" }}>
                        <Icon className="w-5 h-5" style={{ color: "#f97316" } as React.CSSProperties} />
                      </div>
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{node.label}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{node.sub}</div>
                    </SpotlightCard>
                  </motion.div>
                  {i < 2 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: 0.3 + i * 0.2, duration: 0.5 }}
                      className="hidden md:block h-px flex-1 origin-left"
                      style={{ background: "linear-gradient(90deg, #f97316, transparent)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. FEATURES BENTO GRID ────────────────────────────────────────── */}
      <section id="features" className="py-12 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>Features</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>15 tools. One command.</h2>
            <p className="text-center max-w-xl mx-auto mb-12" style={{ color: "var(--text-secondary)" }}>Everything from NLP trade execution to tax reporting — unified in a single agentic interface.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[160px]">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const colSpan = f.size === "large" ? "md:col-span-2 md:row-span-2" : f.size === "medium" ? "md:col-span-2" : "md:col-span-1";
              return (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: (i % 4) * 0.07, duration: 0.5 }}
                  className={colSpan}
                >
                  <SpotlightCard className="h-full p-5 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-[8px] flex items-center justify-center mb-3"
                        style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.2)" }}>
                        <Icon className="w-4 h-4" style={{ color: "#f97316" } as React.CSSProperties} />
                      </div>
                      <div className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{f.title}</div>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. AI AGENTS DEEP DIVE ────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#f97316" }}>AI Agents</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black mb-8 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Specialist agents,<br />working for you</h2>
            <div className="flex flex-col gap-3">
              {AGENTS.map((agent, i) => {
                const Icon = agent.icon;
                const isActive = activeAgent === i;
                return (
                  <motion.div key={agent.name}
                    onClick={() => setActiveAgent(i)}
                    animate={{ opacity: isActive ? 1 : 0.45, scale: isActive ? 1 : 0.98 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-4 p-4 rounded-[8px] cursor-pointer border transition-all"
                    style={{
                      borderColor: isActive ? "rgba(249,115,22,0.4)" : "var(--glass-border)",
                      background: isActive ? "rgba(249,115,22,0.06)" : "var(--bg-card)",
                    }}
                  >
                    <div className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: isActive ? "rgba(249,115,22,0.15)" : "var(--surface-2)" }}>
                      <Icon className="w-4 h-4" style={{ color: isActive ? "#f97316" : "var(--text-muted)" } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{agent.name}</span>
                      {isActive && <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: "#22c55e" }} />}
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{agent.confidence}%</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeAgent}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="p-6 rounded-[8px] border"
                style={{ borderColor: "rgba(249,115,22,0.3)", background: "var(--bg-card)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                  <span className="font-bold" style={{ color: "#f97316" }}>{AGENTS[activeAgent].name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", fontFamily: "var(--font-mono)" }}>ACTIVE</span>
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>{AGENTS[activeAgent].desc}</p>
                <div>
                  <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                    <span>Confidence Score</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{AGENTS[activeAgent].confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${AGENTS[activeAgent].confidence}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                      className="h-2 rounded-full"
                      style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
                    />
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--glass-border)" }}>
                  <div className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Circuit Breaker Levels</div>
                  {[
                    { label: "Warning", pct: 60, color: "#eab308" },
                    { label: "Reduce",  pct: 75, color: "#f97316" },
                    { label: "Halt",    pct: 90, color: "#ef4444" },
                  ].map((level) => (
                    <div key={level.label} className="flex items-center gap-3 mb-2">
                      <span className="text-xs w-16" style={{ color: "var(--text-muted)" }}>{level.label}</span>
                      <div className="flex-1 h-1.5 rounded-full relative" style={{ background: "var(--surface-2)" }}>
                        <div className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: `${level.pct}%`, background: level.color, opacity: 0.7 }} />
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{level.pct}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ── 7. SIGNAL ENGINE ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>Signal Engine</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Real-time trading signals</h2>
            <p className="text-center max-w-xl mx-auto mb-12" style={{ color: "var(--text-secondary)" }}>High-confidence directional signals powered by multi-source confluence scoring — updated every 30 seconds.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SIGNALS.map((sig, i) => {
              const sparkData = sig.data.map((v, j) => ({ v, j }));
              const color = sig.direction === "LONG" ? "#22c55e" : sig.direction === "SHORT" ? "#ef4444" : "#60a5fa";
              return (
                <motion.div key={sig.pair}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <SpotlightCard className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{sig.pair}</span>
                      <SignalBadge dir={sig.direction} />
                    </div>
                    <div className="h-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData}>
                          <defs>
                            <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#sg${i})`} strokeWidth={1.5} dot={false} isAnimationActive />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        <span>Confidence</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{sig.confidence}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${sig.confidence}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                          className="h-1.5 rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Updated 30s ago</span>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 8. MACRO INTELLIGENCE ─────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#f97316" }}>Macro Intelligence</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black mb-2 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>ETF Flow Intelligence</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Track institutional capital flows across Spot Bitcoin ETFs and correlate with price action.</p>
            <div className="rounded-[8px] border p-4" style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)" }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ETF_DATA}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="inflow" stroke="#22c55e" fill="url(#inflowGrad)" strokeWidth={2} dot={false} isAnimationActive />
                  <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} dot={false} isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#f97316" }}>Macro Calendar</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black mb-6 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Upcoming events</h2>
            <div className="flex flex-col gap-0">
              {MACRO_EVENTS.map((ev, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="flex items-center gap-4 py-3 border-b"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  <span className="text-xs w-14 flex-shrink-0" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ev.date}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-bold w-16 text-center flex-shrink-0"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>{ev.category}</span>
                  <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{ev.title}</span>
                  <ImpactBadge impact={ev.impact} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 9. DEX EXECUTION FLOW ─────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-4xl mx-auto" ref={execRef}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>DEX Execution</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Trade in plain English</h2>
            <p className="text-center max-w-xl mx-auto mb-16" style={{ color: "var(--text-secondary)" }}>Type your intent. Our NLP agent parses it, structures the order, and sends it to SoDEX — you just confirm.</p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
            {[
              { icon: MessageSquare, label: "Natural Language",  sub: "\"Buy 0.5 BTC with 2% stop\"" },
              { icon: Brain,         label: "NLP Agent",         sub: "Parse intent → build order" },
              { icon: Database,      label: "SoDEX Order",       sub: "EIP-712 signed transaction" },
              { icon: Check,         label: "Confirmed",         sub: "On-chain confirmation" },
            ].map((step, i) => {
              const Icon = step.icon;
              const lit = execStep >= i;
              return (
                <div key={i} className="flex items-center gap-3 w-full md:w-auto">
                  <motion.div
                    animate={{ opacity: lit ? 1 : 0.3, scale: lit ? 1 : 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="flex-1 md:flex-none p-4 rounded-[8px] border text-center"
                    style={{
                      minWidth: 130,
                      borderColor: lit ? "rgba(249,115,22,0.45)" : "var(--glass-border)",
                      background: lit ? "rgba(249,115,22,0.07)" : "var(--bg-card)",
                    }}
                  >
                    <div className="w-9 h-9 rounded-[8px] flex items-center justify-center mx-auto mb-2"
                      style={{ background: lit ? "rgba(249,115,22,0.15)" : "var(--surface-2)" }}>
                      <Icon className="w-4 h-4" style={{ color: lit ? "#f97316" : "var(--text-muted)" } as React.CSSProperties} />
                    </div>
                    <div className="font-bold text-xs mb-1" style={{ color: "var(--text-primary)" }}>{step.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{step.sub}</div>
                  </motion.div>
                  {i < 3 && (
                    <motion.div
                      animate={{ scaleX: execStep > i ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="hidden md:block h-px flex-1 origin-left"
                      style={{ background: "#f97316" }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="rounded-[8px] border overflow-hidden"
            style={{ borderColor: "var(--glass-border)", background: theme === "dark" ? "#0a0b10" : "#f8f8f8" }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <div className="flex gap-1.5">{["#ef4444","#eab308","#22c55e"].map((c) => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}</div>
              <span className="text-xs ml-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>EIP-712 · SoDEX Order</span>
            </div>
            <pre className="p-5 text-xs overflow-x-auto" style={{ color: "#f97316", fontFamily: "var(--font-mono)", lineHeight: 1.7 }}>{`{
  "types": {
    "Order": [
      { "name": "maker",     "type": "address" },
      { "name": "asset",     "type": "string"  },
      { "name": "side",      "type": "string"  },
      { "name": "quantity",  "type": "uint256" },
      { "name": "stopLoss",  "type": "uint256" },
      { "name": "nonce",     "type": "uint256" }
    ]
  },
  "message": {
    "asset":    "BTC-USDT",
    "side":     "BUY",
    "quantity": "0.5",
    "stopLoss": "2.00%",
    "nonce":    "0x4a2f..."
  }
}`}</pre>
          </motion.div>
        </div>
      </section>

      {/* ── 10. TELEGRAM BOT + IDENTITY LINKING ──────────────────────────── */}
      <section id="bot" className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#0088cc" }}>Telegram Bot</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Trade from your phone
            </h2>
            <p className="text-center max-w-xl mx-auto mb-16 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The SoSoMind Telegram bot delivers real-time signals, portfolio updates, and DEX execution — no browser needed. Link your bot wallet to your dashboard in three steps.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                step: "01", title: "Start the Bot",
                desc: "Open @sosomind_bot on Telegram. A secure EVM wallet is auto-generated — no seed phrases, no setup.",
                icon: Send, color: "#0088cc",
              },
              {
                step: "02", title: "Connect Dashboard",
                desc: "Connect MetaMask on the web dashboard. Go to Profile and tap \"Generate Link Code\" to get a one-time code.",
                icon: Wallet, color: "#f97316",
              },
              {
                step: "03", title: "Run /link",
                desc: "Send /link <code> in the bot. Your Telegram identity permanently merges with your dashboard wallet.",
                icon: Check, color: "#22c55e",
              },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}>
                  <SpotlightCard className="p-6 h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-black font-mono" style={{ color: s.color, fontFamily: "var(--font-mono)" }}>{s.step}</span>
                      <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
                        style={{ background: s.color + "15", border: `1px solid ${s.color}30` }}>
                        <Icon className="w-4 h-4" style={{ color: s.color } as React.CSSProperties} />
                      </div>
                    </div>
                    <div className="font-bold mb-2 text-sm" style={{ color: "var(--text-primary)" }}>{s.title}</div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>
          <div className="text-center">
            <a href="https://t.me/sosomind_bot" target="_blank" rel="noopener noreferrer">
              <MagneticButton
                className="inline-flex items-center gap-2 px-8 py-4 rounded-[20px] font-bold text-white text-base"
                style={{ background: "linear-gradient(135deg,#0088cc 0%,#0066aa 100%)" }}
              >
                <Send className="w-5 h-5" /> Start SoSoMind Bot
              </MagneticButton>
            </a>
          </div>
        </div>
      </section>

      {/* ── 11. LEADERBOARD + MARKETPLACE ────────────────────────────────── */}
      <section className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#f97316" }}>Community</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black mb-6 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Trader Leaderboard</h2>
            <div className="flex flex-col gap-3 mb-8">
              {LEADERBOARD.map((t, i) => (
                <motion.div key={t.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.45 }}
                >
                  <SpotlightCard className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                      style={{
                        background: i === 0 ? "rgba(234,179,8,0.15)" : i === 1 ? "rgba(148,163,184,0.15)" : "rgba(180,123,89,0.15)",
                        color: i === 0 ? "#eab308" : i === 1 ? "#94a3b8" : "#b47b59",
                        border: "1px solid currentColor",
                      }}>
                      {t.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{t.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t.signals} signals · {t.winRate} win rate</div>
                    </div>
                    <span className="font-black text-sm" style={{ color: "#22c55e" }}>{t.returns}</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[["500+","Active Traders"],["18K+","Signals Published"]].map(([v, l]) => (
                <div key={l} className="text-center p-4 rounded-[8px] border" style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)" }}>
                  <div className="text-2xl font-black" style={{ color: "#f97316" }}>{v}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#f97316" }}>Marketplace</p>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black mb-6 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Signal Strategies</h2>
            {[
              { name: "Momentum Alpha",     author: "alpha_sage",  winRate: "74%", subs: 312, badge: "HOT" },
              { name: "ETF Flow Arbitrage", author: "etf_quant",   winRate: "68%", subs: 189, badge: "NEW" },
              { name: "Whale Reversal",     author: "whale_watch", winRate: "65%", subs: 247, badge: "PRO" },
            ].map((s, i) => (
              <motion.div key={s.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
                className="mb-3"
              >
                <SpotlightCard className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>by {s.author}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>{s.badge}</span>
                  </div>
                  <div className="flex gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>Win rate <strong style={{ color: "#22c55e" }}>{s.winRate}</strong></span>
                    <span>{s.subs} subscribers</span>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 11. DATA SOURCES ──────────────────────────────────────────────── */}
      <section id="data" className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>Data Sources</p>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-center mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>13 live data streams</h2>
            <p className="text-center max-w-xl mx-auto mb-12" style={{ color: "var(--text-secondary)" }}>Every agent is powered by real-time data from the most comprehensive crypto intelligence network.</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {DATA_SOURCES.map((ds, i) => {
              const Icon = ds.icon;
              const isMCP = ds.type === "MCP";
              return (
                <motion.div key={ds.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: (i % 5) * 0.07, duration: 0.45 }}
                >
                  <SpotlightCard className="p-4 text-center h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
                      style={{
                        background: isMCP ? "rgba(139,92,246,0.12)" : "rgba(249,115,22,0.1)",
                        border: isMCP ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(249,115,22,0.2)",
                      }}>
                      {isMCP
                        ? <MCP size={16} style={{ color: "#8b5cf6" }} />
                        : <Icon className="w-4 h-4" style={{ color: "#f97316" } as React.CSSProperties} />}
                    </div>
                    <div className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>{ds.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: isMCP ? "rgba(139,92,246,0.1)" : "rgba(249,115,22,0.08)",
                          color: isMCP ? "#8b5cf6" : "#f97316",
                          fontFamily: "var(--font-mono)",
                        }}>{ds.type}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{ds.tools}t</span>
                    </div>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>

          {/* AI Models powering the agents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-12 pt-10 border-t" style={{ borderColor: "var(--glass-border)" }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-6 text-center" style={{ color: "var(--text-muted)" }}>AI Models Inside</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {[
                { label: "Claude", Icon: Claude,   color: "#d97706" },
                { label: "GPT-4",  Icon: OpenAI,   color: "#10b981" },
                { label: "Gemini", Icon: Gemini,   color: "#3b82f6" },
                { label: "DeepSeek", Icon: DeepSeek, color: "#6366f1" },
                { label: "Mistral", Icon: Mistral,  color: "#f59e0b" },
              ].map(({ label, Icon: AiIcon, color }) => (
                <div key={label} className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border transition-all"
                  style={{ borderColor: "var(--glass-border)", background: "var(--bg-card)" }}>
                  <AiIcon size={20} style={{ color }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 12. FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "#f97316" }}>FAQ</p>
            <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-center mb-12 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Common questions</h2>
          </motion.div>
          <div>
            {FAQ_ITEMS.map((item, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="border-b" style={{ borderColor: "var(--glass-border)" }}
              >
                <button className="w-full flex items-center justify-between py-5 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.q}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 13. FINAL CTA + FOOTER ────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t relative overflow-hidden" style={{ borderColor: "var(--glass-border)" }}>
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)" }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7 }}>
            <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Start trading<br />smarter today.
            </h2>
            <p className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
              Connect your wallet and deploy the full AI agent stack in under 60 seconds.
            </p>
            {address ? (
              <Link href="/">
                <MagneticButton
                  className="inline-flex items-center gap-3 px-10 py-5 rounded-[20px] font-bold text-white text-lg"
                  style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
                >
                  Open Dashboard <ArrowRight className="w-5 h-5" />
                </MagneticButton>
              </Link>
            ) : (
              <MagneticButton
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-3 px-10 py-5 rounded-[20px] font-bold text-white text-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
              >
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </MagneticButton>
            )}
          </motion.div>
        </div>
      </section>

      <footer className="border-t py-16 px-6" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <Image
              src="/logo.png"
              alt="SoSoMind"
              width={130}
              height={36}
              className="h-9 w-auto object-contain mb-3"
              style={{ filter: theme === "light" ? "brightness(0.1) saturate(0)" : "none" }}
            />
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The agentic finance operating system for serious crypto traders.
            </p>
            <div className="flex gap-3 mt-5">
              {[
                { Icon: X,     href: "#",                              label: "X / Twitter"    },
                { Icon: Code2, href: "#",                              label: "GitHub"          },
                { Icon: Send,  href: "https://t.me/sosomind_bot",      label: "Telegram Bot"    },
              ].map(({ Icon, href, label }) => (
                <a key={label} href={href}
                  target={href.startsWith("https") ? "_blank" : undefined}
                  rel={href.startsWith("https") ? "noopener noreferrer" : undefined}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors"
                  style={{ borderColor: "var(--glass-border)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = label === "Telegram Bot" ? "#0088cc" : "#f97316"; (e.currentTarget as HTMLAnchorElement).style.borderColor = label === "Telegram Bot" ? "rgba(0,136,204,0.4)" : "rgba(249,115,22,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--glass-border)"; }}>
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: "Product",   links: ["Features","Agents","Signal Engine","Macro Overlay","DEX Execution"] },
            { title: "Resources", links: ["Documentation","API Reference","Changelog","Status","Blog"] },
            { title: "Legal",     links: ["Privacy Policy","Terms of Service","Risk Disclosure","Cookies"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>{col.title}</div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm transition-colors" style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)"; }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-5xl mx-auto mt-12 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--glass-border)" }}>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>© {new Date().getFullYear()} SoSoMind. Built for serious traders.</span>
          <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>v2.0.0 · Powered by SoSoValue + SoDEX</span>
        </div>
      </footer>

      <style>{`
        @keyframes gridFloat {
          0%   { background-position: 0 0; }
          100% { background-position: 28px 28px; }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        [data-theme] * { cursor: none; }
      `}</style>
    </div>
  );
}
