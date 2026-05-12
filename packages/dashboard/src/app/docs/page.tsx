"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BookOpen, Cpu, Zap, BarChart2, Globe, Bot, Shield, Radio,
  Database, Code2, Server, Map, ChevronRight, Copy, Check,
  Menu, X, Activity, Workflow, Package, FileCode
} from "lucide-react";

type StatusType = "LIVE" | "EVOLVING" | "TESTNET" | "ROADMAP";
interface NavSection { id: string; label: string; icon: React.ElementType; subsections?: { id: string; label: string }[]; }

const NAV_SECTIONS: NavSection[] = [
  { id: "overview",    label: "Overview",            icon: BookOpen  },
  { id: "architecture",label: "Architecture",        icon: Workflow,   subsections: [{ id: "arch-system", label: "System Overview" }, { id: "arch-stack", label: "Tech Stack" }] },
  { id: "agents",      label: "Agent System",        icon: Cpu,        subsections: [{ id: "agents-orchestrator", label: "Orchestrator" }, { id: "agents-research", label: "Research Agent" }, { id: "agents-risk", label: "Risk Agent" }, { id: "agents-macro", label: "Macro Overlay" }, { id: "agents-execution", label: "Execution Agent" }, { id: "agents-circuit", label: "Circuit Breaker" }] },
  { id: "signals",     label: "Signal Engine",       icon: Zap,        subsections: [{ id: "signals-scoring", label: "Confidence Scoring" }, { id: "signals-outcomes", label: "Outcome Tracking" }, { id: "signals-payload", label: "Signal Payload" }] },
  { id: "ssi",         label: "Sector Intelligence", icon: BarChart2,  subsections: [{ id: "ssi-scoring", label: "Composite Scoring" }, { id: "ssi-sectors", label: "13 Sectors" }, { id: "ssi-basket", label: "Basket Trading" }] },
  { id: "execution",   label: "DEX Execution",       icon: Globe,      subsections: [{ id: "exec-eip712", label: "EIP-712 Signing" }, { id: "exec-orders", label: "Order Types" }, { id: "exec-symbols", label: "Testnet Symbols" }] },
  { id: "telegram",    label: "Telegram Bot",        icon: Bot,        subsections: [{ id: "tg-commands", label: "Commands Reference" }, { id: "tg-wallet", label: "Embedded Wallets" }, { id: "tg-alerts", label: "Anomaly Alerts" }] },
  { id: "mcp",         label: "MCP Tools",           icon: Package,    subsections: [{ id: "mcp-sosovalue", label: "mcp-sosovalue (35t)" }, { id: "mcp-sodex", label: "mcp-sodex (25t)" }] },
  { id: "openclaw",    label: "OpenClaw Skills",     icon: FileCode   },
  { id: "risk",        label: "Risk Management",     icon: Shield     },
  { id: "websocket",   label: "WebSocket API",       icon: Radio      },
  { id: "database",    label: "Database Schema",     icon: Database   },
  { id: "api",         label: "REST API Reference",  icon: Code2      },
  { id: "deployment",  label: "Deployment",          icon: Server     },
  { id: "roadmap",     label: "Roadmap",             icon: Map        },
];

function StatusBadge({ status }: { status: StatusType }) {
  const styles: Record<StatusType, { bg: string; color: string; border: string }> = {
    LIVE:     { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", border: "rgba(34,197,94,0.3)"  },
    EVOLVING: { bg: "rgba(249,115,22,0.12)", color: "#f97316", border: "rgba(249,115,22,0.3)" },
    TESTNET:  { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "rgba(59,130,246,0.3)" },
    ROADMAP:  { bg: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "rgba(139,92,246,0.3)" },
  };
  const s = styles[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{status}
    </span>
  );
}

function SectionTitle({ id, children, status }: { id: string; children: React.ReactNode; status?: StatusType }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-6 pt-2 scroll-mt-8">
      <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>{children}</h2>
      {status && <StatusBadge status={status} />}
    </div>
  );
}

function SubTitle({ id, children, status }: { id: string; children: React.ReactNode; status?: StatusType }) {
  return (
    <div id={id} className="flex items-center gap-2 mb-4 mt-8 scroll-mt-8">
      <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{children}</h3>
      {status && <StatusBadge status={status} />}
    </div>
  );
}

function CodeBlock({ code, lang = "typescript" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-[8px] overflow-hidden mb-6" style={{ border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--glass-border)", background: "rgba(0,0,0,0.3)" }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">{["#ef4444","#eab308","#22c55e"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}</div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{lang}</span>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-xs overflow-x-auto leading-relaxed" style={{ color: "#f97316", fontFamily: "var(--font-mono)", background: "var(--bg-card)" }}><code>{code}</code></pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto mb-6 rounded-[8px]" style={{ border: "1px solid var(--glass-border)" }}>
      <table className="w-full text-sm">
        <thead><tr className="border-b" style={{ borderColor: "var(--glass-border)", background: "rgba(249,115,22,0.06)" }}>
          {headers.map(h => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i} className="border-b" style={{ borderColor: "var(--glass-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.08)" }}>
            {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-xs" style={{ color: j === 0 ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: j === 0 ? "var(--font-mono)" : undefined }}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function InfoBox({ children, accent = "#f97316" }: { children: React.ReactNode; accent?: string }) {
  return <div className="rounded-[8px] p-4 mb-6 text-sm leading-relaxed" style={{ background: `${accent}10`, border: `1px solid ${accent}30`, color: "var(--text-secondary)", borderLeft: `3px solid ${accent}` }}>{children}</div>;
}
function Divider() { return <div className="my-12 border-t" style={{ borderColor: "var(--glass-border)" }} />; }
function ArchDiagram() {
  return (
    <div className="rounded-[12px] p-6 mb-8" style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="rounded-[8px] p-4" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#8b5cf6" }}>Data Sources</div>
          {["SoSoValue (35 EP)","SoDEX (25 tools)","Macro Calendar","ETF Flow API","Fundraising DB","News Feed","Crypto Stocks"].map(s => (
            <div key={s} className="text-[11px] py-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <div className="w-1 h-1 rounded-full" style={{ background: "#8b5cf6" }} />{s}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-[8px] p-4 w-full" style={{ background: "rgba(249,115,22,0.08)", border: "2px solid rgba(249,115,22,0.4)" }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: "#f97316" }}>Orchestrator</div>
            {["Research Agent","Risk Agent","Macro Overlay","Execution Agent","Circuit Breaker"].map(a => (
              <div key={a} className="text-[11px] py-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <div className="w-1 h-1 rounded-full" style={{ background: "#f97316" }} />{a}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[8px] p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#22c55e" }}>Outputs</div>
          {["Structured Signals","SoDEX Orders (EIP-712)","Telegram Alerts","WebSocket Events","SSI Sector Scores","Content Briefs","Outcome Tracking"].map(s => (
            <div key={s} className="text-[11px] py-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <div className="w-1 h-1 rounded-full" style={{ background: "#22c55e" }} />{s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [openSections, setOpenSections] = useState<string[]>(["agents","signals","ssi","execution","telegram","mcp"]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            // Map sub-section IDs back to their parent section ID
            const rawId = e.target.id;
            const sectionId = NAV_SECTIONS.find(s =>
              s.id === rawId || s.subsections?.some(sub => sub.id === rawId)
            )?.id ?? rawId.split("-")[0];
            setActiveSection(sectionId);
          }
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );
    container.querySelectorAll("[data-section]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const container = contentRef.current;
    const el = document.getElementById(id);
    if (!el) { setSidebarOpen(false); return; }
    if (container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const offset = elTop - containerTop + container.scrollTop - 24;
      container.scrollTo({ top: offset, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSidebarOpen(false);
  }, []);

  const toggleSection = (id: string) =>
    setOpenSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  function SidebarContent() {
    return (
      <nav className="flex flex-col gap-0.5">
        <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 mb-1" style={{ color: "var(--text-muted)" }}>Documentation</div>
        {NAV_SECTIONS.map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const isOpen = openSections.includes(section.id);
          return (
            <div key={section.id}>
              <button onClick={() => { if (section.subsections) { toggleSection(section.id); scrollTo(section.id); } else scrollTo(section.id); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-left transition-all text-[13px] font-medium"
                style={{ color: isActive ? "#f97316" : "var(--text-secondary)", background: isActive ? "rgba(249,115,22,0.08)" : "transparent" }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{section.label}</span>
                {section.subsections && (
                  <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="w-3 h-3" />
                  </motion.div>
                )}
              </button>
              {section.subsections && (
                <AnimatePresence>
                  {isOpen && (
                    <motion.div key="sub" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="ml-6 flex flex-col gap-0.5 py-0.5">
                        {section.subsections.map(sub => (
                          <button key={sub.id} onClick={() => scrollTo(sub.id)}
                            className="text-left text-[12px] px-3 py-1.5 rounded-[4px] transition-all hover:opacity-80"
                            style={{ color: "var(--text-muted)" }}>{sub.label}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-8 px-4"
        style={{ borderRight: "1px solid var(--glass-border)", background: "var(--bg-primary)" }}>
        <Link href="/landing" className="flex items-center gap-2 px-3 mb-8">
          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
            <BookOpen className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SoSoMind Docs</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>v2</span>
        </Link>
        <SidebarContent />
        <div className="mt-auto px-3 pt-6">
          <a href="https://t.me/sosomind_bot" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs py-2 px-3 rounded-[6px]"
            style={{ color: "#0088cc", background: "rgba(0,136,204,0.08)", border: "1px solid rgba(0,136,204,0.2)" }}>
            <Bot className="w-3.5 h-3.5" /> @sosomind_bot
          </a>
        </div>
      </aside>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />
            <motion.aside key="dr" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 overflow-y-auto py-8 px-4 lg:hidden"
              style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--glass-border)" }}>
              <div className="flex items-center justify-between px-3 mb-8">
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SoSoMind Docs</span>
                <button onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <main ref={contentRef} className="flex-1 overflow-auto">
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 lg:hidden"
          style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(16px)" }}>
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-[6px]" style={{ border: "1px solid var(--glass-border)" }}>
            <Menu className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </button>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>SoSoMind Docs</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>v2</span>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-12">          <section data-section id="overview">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f97316" }}>Getting Started</span>
              </div>
              <h1 className="text-4xl font-black mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>SoSoMind Documentation</h1>
              <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)", maxWidth: "60ch" }}>
                SoSoMind is a production-grade agentic finance OS. Five specialist AI agents coordinate market research, risk assessment, macro analysis, and DEX execution through a unified dashboard and Telegram bot.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {[
                  { label: "Dashboard", value: "sosomind.vercel.app", href: "https://sosomind.vercel.app", color: "#f97316", status: "LIVE" as StatusType },
                  { label: "Telegram Bot", value: "@sosomind_bot", href: "https://t.me/sosomind_bot", color: "#0088cc", status: "LIVE" as StatusType },
                  { label: "Backend", value: "Render.com port 10000", href: "#deployment", color: "#22c55e", status: "LIVE" as StatusType },
                ].map(item => (
                  <a key={item.label} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="rounded-[8px] p-4 block" style={{ border: "1px solid var(--glass-border)", background: "var(--bg-card)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-sm font-mono font-semibold" style={{ color: item.color }}>{item.value}</div>
                  </a>
                ))}
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>Quick Start</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { n: "01", title: "Connect Wallet", desc: "Visit sosomind.vercel.app, connect MetaMask or WalletConnect." },
                    { n: "02", title: "Start the Bot", desc: "Open @sosomind_bot on Telegram. An embedded EVM wallet is created automatically." },
                    { n: "03", title: "Request a Signal", desc: "Send /research BTC in Telegram or use the Trade page to trigger the full agent pipeline." },
                  ].map(s => (
                    <div key={s.n} className="rounded-[8px] p-4" style={{ border: "1px solid var(--glass-border)", background: "var(--bg-card)" }}>
                      <div className="text-xs font-black font-mono mb-2" style={{ color: "#f97316" }}>{s.n}</div>
                      <div className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>{s.title}</div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>
          <Divider />
          <section data-section id="architecture">
            <SectionTitle id="architecture" status="LIVE">Architecture</SectionTitle>
            <SubTitle id="arch-system">System Overview</SubTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              SoSoMind has three main layers: live data ingestion (13 sources), a multi-agent intelligence layer (5 specialist agents + orchestrator), and an output layer (signals, orders, alerts, WebSocket events).
            </p>
            <ArchDiagram />
            <SubTitle id="arch-stack">Tech Stack</SubTitle>
            <Table headers={["Layer", "Technology", "Status"]} rows={[
              ["Backend", "Express + TypeScript, Node 20, Render.com", <StatusBadge key="l" status="LIVE" />],
              ["Frontend", "Next.js 14, App Router, React 19, Vercel", <StatusBadge key="l" status="LIVE" />],
              ["AI Chain", "Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini", <StatusBadge key="l" status="LIVE" />],
              ["Signing", "EIP-712, ethers.js v6 (non-custodial)", <StatusBadge key="l" status="LIVE" />],
              ["DEX", "SoDEX testnet (chainId 138565)", <StatusBadge key="t" status="TESTNET" />],
              ["Database", "Supabase PostgreSQL, 9 tables", <StatusBadge key="l" status="LIVE" />],
              ["Cache", "Upstash Redis, 5-min TTL, SHA-256 keyed", <StatusBadge key="l" status="LIVE" />],
              ["WebSocket", "ws server, port 10001, 5 channels", <StatusBadge key="l" status="LIVE" />],
              ["MCP", "stdio transport, 35+25 tools", <StatusBadge key="l" status="LIVE" />],
              ["Bot", "grammY + AES-256-GCM embedded wallets", <StatusBadge key="l" status="LIVE" />],
            ]} />
          </section>          <Divider />
          <section data-section id="agents">
            <SectionTitle id="agents" status="LIVE">Agent System</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              Five specialist agents are orchestrated sequentially. Each agent has a single domain responsibility, with each agent output feeding the next.
            </p>
            <SubTitle id="agents-orchestrator">Orchestrator</SubTitle>
            <InfoBox>The Orchestrator runs a 4-hour research loop. It coordinates the agent pipeline, enforces the circuit breaker, and routes outputs to Supabase, WebSocket, and Telegram.</InfoBox>
            <CodeBlock lang="typescript" code={"// Orchestrator loop — every 4 hours\nasync function runCycle(asset: string) {\n  if (circuitBreaker.isHalted(asset)) return;\n  const research = await ResearchAgent.run(asset);    // 13+ parallel fetches\n  const risk     = await RiskAgent.preflight(research); // 4-check gate\n  if (!risk.approved) return;\n  const macro    = await MacroOverlayAgent.run(research);\n  const signal   = await synthesise(research, macro);\n  await ExecutionAgent.execute(signal);                 // EIP-712 + SoDEX\n  await supabase.from('signals').insert(signal);\n  wsServer.broadcast('signals', signal);\n}"} />
            <SubTitle id="agents-research">Research Agent</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Fetches 13+ data sources in parallel using Promise.allSettled. Never throws on partial failure.</p>
            <Table headers={["Source","Data Fetched","Caching"]} rows={[
              ["SoSoValue API","Market snapshot, klines, ETF flows, sector indices, fundraising","Redis 5min"],
              ["SoDEX","Live orderbook, recent trades, ticker prices","No cache"],
              ["Macro Calendar","Upcoming FOMC, CPI, NFP, GDP events","Redis 5min"],
              ["Crypto Stocks","MSTR, COIN, MARA 7-day klines and market cap","Redis 5min"],
              ["BTC Treasuries","Corporate BTC holdings, recent purchases","Redis 5min"],
              ["News Feed","Hot crypto news + featured stories","Redis 5min"],
              ["Fundraising DB","Recent VC rounds and project raises","Redis 5min"],
            ]} />
            <SubTitle id="agents-risk">Risk Agent</SubTitle>
            <InfoBox accent="#ef4444"><strong>4-check preflight gate.</strong> A signal must pass all 4 checks or it is blocked. Blocked signals are logged to agent_logs with the rejection reason.</InfoBox>
            <Table headers={["Check","Threshold","Action on Fail"]} rows={[
              ["Daily trade cap","3 trades per asset per 24h","Block signal"],
              ["Concentration limit","30% max exposure per single asset","Block signal"],
              ["ATR volatility filter","ATR > 15% of price","Block signal"],
              ["Drawdown protection","Daily portfolio PnL < -5%","Halt all trading"],
            ]} />
            <SubTitle id="agents-macro">Macro Overlay Agent</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Classifies market regime as risk-on, risk-off, or neutral. Regime affects signal confidence by 10-15 points.</p>
            <Table headers={["Input","Weight","Logic"]} rows={[
              ["ETF Net Flow (7d)","40%","Positive = bullish institutional pressure"],
              ["Macro Events (48h)","30%","High-impact events in next 48h = caution"],
              ["BTC 30d Momentum","30%","Price vs 30-day MA — above = risk-on"],
            ]} />
            <SubTitle id="agents-execution">Execution Agent</SubTitle>
            <InfoBox>All orders are <strong>limit + IOC</strong>. Market orders are forbidden on SoDEX testnet (MissingOraclePrice error). Slippage: +0.5% BUY, -0.5% SELL.</InfoBox>
            <CodeBlock lang="typescript" code={"// Order construction\nconst price = Math.round(midPrice * (1 + 0.005)); // +0.5% slippage BUY\nconst qty   = (usdcAmount / price).toFixed(5);     // quantityPrecision=5\n\nconst order = {\n  symbol: 'vBTC_vUSDC',   // testnet symbol\n  side:   'BUY',\n  type:   'LIMIT',\n  timeInForce: 'IOC',\n  quantity: qty,           // string, quantityPrecision=5\n  price:    price.toString(), // string, pricePrecision=0 for BTC\n};"} />
            <SubTitle id="agents-circuit">Circuit Breaker</SubTitle>
            <Table headers={["Trigger","Scope","Cooldown"]} rows={[
              ["3 consecutive losses","Global — all assets halted","1 hour (auto-reset)"],
              ["2 consecutive losses on asset","Single asset blocked","24 hours"],
              [">15% price drawdown on asset","Single asset blocked","24 hours"],
              ["Daily drawdown < -5%","Global halt","Manual reset required"],
            ]} />
          </section>
          <Divider />
          <section data-section id="signals">
            <SectionTitle id="signals" status="LIVE">Signal Engine</SectionTitle>
            <SubTitle id="signals-scoring">Confidence Scoring</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Each signal receives a 0-100 confidence score synthesised by the AI chain. Score reflects directional conviction, not probability of profit.</p>
            <Table headers={["Score Range","Label","Action"]} rows={[
              ["80-100","Strong conviction","Full position size"],
              ["65-79","Moderate conviction","Half position size"],
              ["50-64","Weak conviction","Observe only"],
              ["< 50","No signal","Signal not emitted"],
            ]} />
            <SubTitle id="signals-outcomes">Outcome Tracking</SubTitle>
            <InfoBox>Every signal is evaluated hourly. Outcomes stored in Supabase and displayed with badges in the Signals feed and on /api/signals/track-record.</InfoBox>
            <Table headers={["Outcome","Condition","Badge Color"]} rows={[
              ["HIT","Price reached take-profit target (0.5% tolerance)","Green"],
              ["STOP","Price reached stop-loss level","Red"],
              ["DRIFT","Signal expired after 72h without resolution","Gray"],
              ["PENDING","Signal active, evaluation ongoing","Orange"],
            ]} />
            <SubTitle id="signals-payload">Signal Payload</SubTitle>
            <CodeBlock lang="typescript" code={"interface Signal {\n  id:         string;   // uuid\n  asset:      string;   // 'BTC' | 'ETH' | ...\n  direction:  'LONG' | 'SHORT' | 'NEUTRAL';\n  confidence: number;   // 0-100\n  entry:      number;   // USD price at signal time\n  takeProfit: number;   // target exit price\n  stopLoss:   number;   // maximum loss price\n  rationale:  string;   // AI synthesis text\n  citations:  Citation[]; // [{source, excerpt, index}]\n  regime:     string;   // 'risk-on' | 'risk-off' | 'neutral'\n  createdAt:  string;   // ISO timestamp\n  outcome?:   'HIT' | 'STOP' | 'DRIFT' | 'PENDING';\n  outcomeAt?: string;\n}"} />
          </section>
          <Divider />
          <section data-section id="ssi">
            <SectionTitle id="ssi" status="LIVE">Sector Intelligence System (SSI)</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>Tracks 13 crypto sectors using composite scoring. Scores computed on demand, cached in Redis 5min.</p>
            <SubTitle id="ssi-scoring">Composite Scoring Formula</SubTitle>
            <Table headers={["Signal","Weight","Source"]} rows={[
              ["S1 — Fundraising Velocity","30%","7-day project raise activity via getFundraisingProjects"],
              ["S2 — Institutional Momentum","35%","SSI index 7-day ROI via getIndexMarketSnapshot"],
              ["S3 — Sector Trend","35%","SSI 30-day kline price trend via getIndexKlines(30)"],
            ]} />
            <CodeBlock lang="typescript" code={"const score = (S1 * 0.30) + (S2 * 0.35) + (S3 * 0.35);\nconst verdict =\n  score >= 75 ? 'STRONG_BUY' :\n  score >= 55 ? 'BUY'        :\n  score >= 35 ? 'NEUTRAL'    : 'SELL';"} />
            <SubTitle id="ssi-sectors">13 Tracked Sectors</SubTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
              {["DeFi (ssiDeFi)","AI (ssiAI)","Layer 1 (ssiLayer1)","Layer 2 (ssiLayer2)","RWA (ssiRWA)","NFT (ssiNFT)","GameFi (ssiGameFi)","MAG7 (ssiMAG7)","Meme (ssiMeme)","PayFi (ssiPayFi)","CeFi (ssiCeFi)","SocialFi (ssiSocialFi)","DePIN (ssiDePIN)"].map(s => (
                <div key={s} className="text-xs px-3 py-2 rounded-[6px] font-mono" style={{ background: "rgba(139,92,246,0.08)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)" }}>{s}</div>
              ))}
            </div>
            <SubTitle id="ssi-basket">Basket Trading</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Sector verdicts route to SoDEX trades via SECTOR_PROXY. On testnet, all 13 sectors map to BTC or ETH as proxy assets.</p>
            <CodeBlock lang="typescript" code={"const SECTOR_PROXY: Record<string, string> = {\n  ssiDeFi:'ETH', ssiAI:'ETH', ssiLayer1:'ETH', ssiLayer2:'ETH',\n  ssiRWA:'ETH',  ssiNFT:'ETH', ssiGameFi:'ETH', ssiMAG7:'BTC',\n  ssiMeme:'BTC', ssiPayFi:'ETH', ssiCeFi:'BTC',\n  ssiSocialFi:'ETH', ssiDePIN:'ETH',\n};"} />
          </section>          <Divider />
          <section data-section id="execution">
            <SectionTitle id="execution" status="TESTNET">DEX Execution</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              All trades are signed using EIP-712 typed data and submitted to SoDEX testnet (chainId 138565) via REST. Wallets are non-custodial — private keys never leave the backend.
            </p>
            <SubTitle id="exec-eip712">EIP-712 Signing</SubTitle>
            <CodeBlock lang="typescript" code={"// Full signing implementation (packages/backend/src/clients/sodex.ts)\nconst envelope  = JSON.stringify({ type: actionName, params: body });\nconst payloadHash = ethers.keccak256(ethers.toUtf8Bytes(envelope));\n\nconst domain = {\n  name: 'SoDEX', version: '1',\n  chainId: 138565,\n  verifyingContract: '0x...'\n};\nconst types = {\n  ActionPayload: [{ name: 'payloadHash', type: 'bytes32' }]\n};\n\nconst rawSig  = await wallet.signTypedData(domain, types, { payloadHash });\nconst sigBytes = ethers.Signature.from(rawSig);\nconst v = sigBytes.v - 27;\nconst signature = sigBytes.r + sigBytes.s.slice(2) + v.toString(16).padStart(2, '0');\n\nheaders['X-API-Signature'] = signature;\nheaders['X-API-Chain']     = '138565';"} />
            <SubTitle id="exec-orders">Order Types &amp; Rules</SubTitle>
            <InfoBox accent="#ef4444"><strong>Market orders are rejected</strong> by SoDEX testnet (MissingOraclePrice). All orders must be LIMIT + IOC.</InfoBox>
            <Table headers={["Rule","Value","Reason"]} rows={[
              ["Order type","LIMIT only","Market orders unsupported on testnet"],
              ["Time in force","IOC","Immediate cancel if not filled"],
              ["BUY slippage","+0.5% above mid","Ensures fill above orderbook mid"],
              ["SELL slippage","-0.5% below mid","Ensures fill below orderbook mid"],
              ["BTC price precision","0 decimals","pricePrecision=0 for BTC pairs"],
              ["BTC quantity precision","5 decimals","quantityPrecision=5"],
              ["Min order","$10 USDC","Enforced at backend, not protocol"],
              ["Max order","10% of wallet balance","Risk rule, per signal"],
            ]} />
            <SubTitle id="exec-symbols">Testnet Symbols</SubTitle>
            <Table headers={["Symbol","Type","Quote"]} rows={[
              ["vBTC_vUSDC","Spot","vUSDC"],
              ["vBTCvUSDC","Perps","vUSDC — perpetual, no expiry"],
              ["vETH_vUSDC","Spot","vUSDC"],
              ["vETHvUSDC","Perps","vUSDC — perpetual"],
            ]} />
          </section>
          <Divider />
          <section data-section id="telegram">
            <SectionTitle id="telegram" status="LIVE">Telegram Bot</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              @sosomind_bot is the primary user interface. Built with grammY, it handles research requests, wallet management, signal delivery, and live trading alerts.
            </p>
            <SubTitle id="tg-commands">Bot Commands</SubTitle>
            <Table headers={["Command","Description","Status"]} rows={[
              ["/start","Initialise bot, create embedded EVM wallet", <StatusBadge key="1" status="LIVE" />],
              ["/research BTC","Run full 5-agent pipeline on an asset", <StatusBadge key="2" status="LIVE" />],
              ["/signals","Show last 5 signals with confidence + outcome", <StatusBadge key="3" status="LIVE" />],
              ["/portfolio","Display wallet balances (USDC, BTC, ETH)", <StatusBadge key="4" status="LIVE" />],
              ["/market","Live BTC/ETH prices + sector overview", <StatusBadge key="5" status="LIVE" />],
              ["/ssi DeFi","SSI sector score for a given sector", <StatusBadge key="6" status="LIVE" />],
              ["/trade BUY BTC 100","Place a spot order on SoDEX testnet", <StatusBadge key="7" status="TESTNET" />],
              ["/risk","Show current circuit breaker status", <StatusBadge key="8" status="LIVE" />],
              ["/macro","Upcoming macro events (FOMC, CPI, NFP)", <StatusBadge key="9" status="LIVE" />],
              ["/etf","Bitcoin ETF net flow summary", <StatusBadge key="10" status="LIVE" />],
              ["/news","Top 5 crypto news items from SoSoValue", <StatusBadge key="11" status="LIVE" />],
              ["/alert add BTC 70000","Set a price alert for any asset", <StatusBadge key="12" status="LIVE" />],
              ["/wallet","Show embedded wallet address", <StatusBadge key="13" status="LIVE" />],
              ["/export","Export wallet private key (DM only)", <StatusBadge key="14" status="LIVE" />],
              ["/help","Full command reference", <StatusBadge key="15" status="LIVE" />],
            ]} />
            <SubTitle id="tg-wallet">Embedded Wallets</SubTitle>
            <InfoBox>Wallet private keys are encrypted with AES-256-GCM using WALLET_ENCRYPT_KEY. Keys are stored in Supabase user_profiles and decrypted in-memory at signing time. The bot never transmits plaintext private keys.</InfoBox>
            <SubTitle id="tg-alerts">Anomaly Alerts</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>The cron anomaly detector runs every 5 minutes and pushes Telegram alerts for unusual market conditions.</p>
            <Table headers={["Alert Trigger","Condition","Action"]} rows={[
              ["Price spike","Asset moves >8% in 5 minutes","Push Telegram alert"],
              ["ETF flow surge","Daily ETF net flow > $500M","Push Telegram alert"],
              ["Sector momentum","SSI sector score crosses 75","Push Telegram alert + suggest trade"],
              ["Funding rate extreme","Perp funding rate > 0.1% or < -0.1%","Push Telegram alert"],
            ]} />
          </section>
          <Divider />
          <section data-section id="mcp">
            <SectionTitle id="mcp" status="LIVE">MCP Servers</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              Two MCP servers expose SoSoValue and SoDEX as AI-callable tools via stdio transport. Compatible with Claude Desktop, Cursor, VS Code Copilot, and any MCP-enabled client.
            </p>
            <SubTitle id="mcp-sosovalue">mcp-sosovalue</SubTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Wraps 35 SoSoValue API endpoints as structured tools. All tools include input validation and cache-aware HTTP client.</p>
            <Table headers={["Module","Tools","Description"]} rows={[
              ["Market","get_market_snapshot, get_klines, get_currencies","Live crypto prices and historical data"],
              ["ETF","get_etf_list, get_etf_history, get_etf_market_snapshot","Bitcoin ETF AUM, flow, and NAV tracking"],
              ["SSI Index","get_indices, get_index_klines, get_index_constituents","Sector index data and basket weights"],
              ["Macro","get_macro_events, get_macro_event_history","Upcoming and past macro calendar events"],
              ["Fundraising","get_fundraising_projects, get_currency_fundraising","VC round data for all crypto projects"],
              ["News","get_featured_news, get_hot_news, search_news","Real-time news via SoSoValue news API"],
              ["Crypto Stocks","get_crypto_stock_list, get_crypto_stock_klines","MSTR, COIN, MARA and 70+ other stocks"],
              ["Analysis","get_analysis_charts, get_sector_spotlight","AI-generated analysis charts"],
              ["BTC Treasury","get_btc_treasuries, get_btc_purchase_history","Corporate bitcoin holdings"],
            ]} />
            <SubTitle id="mcp-sodex">mcp-sodex</SubTitle>
            <Table headers={["Category","Tools","Status"]} rows={[
              ["Account","get_account_balances, get_perps_balances", <StatusBadge key="t" status="TESTNET" />],
              ["Spot Market","get_spot_tickers, get_spot_orderbook, get_spot_klines, get_spot_trades", <StatusBadge key="t" status="TESTNET" />],
              ["Perps Market","get_perps_mark_prices, get_perps_orderbook, get_perps_klines", <StatusBadge key="t" status="TESTNET" />],
              ["Orders","place_spot_order, cancel_spot_order, get_spot_orders", <StatusBadge key="t" status="TESTNET" />],
              ["Positions","get_perps_positions, get_perps_orders, place_perps_order", <StatusBadge key="t" status="TESTNET" />],
            ]} />
            <div className="mt-6">
              <h4 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Claude Desktop Configuration</h4>
              <CodeBlock lang="json" code={"{\n  \"mcpServers\": {\n    \"sosomind-sosovalue\": {\n      \"command\": \"node\",\n      \"args\": [\"packages/mcp-sosovalue/dist/index.js\"],\n      \"env\": { \"SOSOVALUE_API_KEY\": \"SOSO-...\" }\n    },\n    \"sosomind-sodex\": {\n      \"command\": \"node\",\n      \"args\": [\"packages/mcp-sodex/dist/index.js\"],\n      \"env\": {\n        \"SODEX_PRIVATE_KEY\": \"0x...\",\n        \"SODEX_CHAIN_ID\":    \"138565\",\n        \"SODEX_ACCOUNT_ID\":  \"54647\"\n      }\n    }\n  }\n}"} />
            </div>
          </section>          <Divider />
          <section data-section id="openclaw">
            <SectionTitle id="openclaw" status="EVOLVING">OpenClaw Skills</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              OpenClaw is SoSoMind's agent skill framework. Each skill is a structured SKILL.md that defines a workflow, tool set, and output format for a specific financial domain. Skills are callable from any MCP-enabled AI client.
            </p>
            <Table headers={["Skill","Path","Workflow"]} rows={[
              ["Market Research","skills/market-research/SKILL.md","Triggers full 5-agent pipeline on a target asset"],
              ["Risk Monitor","skills/risk-monitor/SKILL.md","Checks circuit breaker, preflight gate, drawdown"],
              ["Portfolio Briefing","skills/portfolio-briefing/SKILL.md","Summarises wallet positions, PnL, sector exposure"],
              ["Trade Execution","skills/trade-execution/SKILL.md","Validates signal then calls SoDEX EIP-712 signer"],
              ["Content Studio","skills/content-studio/SKILL.md","Drafts market commentary from signal + research data"],
            ]} />
            <InfoBox>Skills use the MCP tools (mcp-sosovalue + mcp-sodex) as their data layer. No separate API keys needed beyond MCP config.</InfoBox>
          </section>
          <Divider />
          <section data-section id="risk">
            <SectionTitle id="risk" status="LIVE">Risk System</SectionTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Exposed as REST endpoints for external monitoring. The preflight endpoint is called by the Orchestrator before every trade.</p>
            <CodeBlock lang="bash" code={"# Preflight check before trade\nGET /api/risk/preflight?asset=BTC&qty=0.001&price=67000&side=BUY&walletUsdc=500\n# => { \"approved\": false, \"reason\": \"concentration_limit\",\n#      \"detail\": \"BTC exposure would reach 38.2% (limit: 30%)\" }\n\n# Circuit breaker status\nGET /api/risk/status\n# => { \"halted\": false, \"blocked\": [\"SOL\"],\n#      \"losses\": { \"BTC\": 1, \"ETH\": 0 } }"} />
          </section>
          <Divider />
          <section data-section id="websocket">
            <SectionTitle id="websocket" status="LIVE">WebSocket Server</SectionTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>ws server on port 10001. Dashboard subscribes on mount and unsubscribes on unmount. All messages are JSON.</p>
            <Table headers={["Channel","Payload","Frequency"]} rows={[
              ["signals","New signal object (full Signal interface)","On new signal (every ~4h)"],
              ["prices","{ asset, price, change24h }","Every 30 seconds"],
              ["alerts","{ type, asset, message }","On anomaly detect (5min cron)"],
              ["portfolio","{ usdc, btc, eth, totalUsd }","On order fill"],
              ["heartbeat","{ ts, status }","Every 60 seconds"],
            ]} />
            <CodeBlock lang="typescript" code={"// React hook — packages/dashboard/src/lib/ws.ts\nconst ws = new WebSocket('wss://your-backend.onrender.com:10001');\n\nws.onmessage = (e) => {\n  const { channel, data } = JSON.parse(e.data);\n  if (channel === 'signals')   onSignal(data);\n  if (channel === 'prices')    updatePrices(data);\n  if (channel === 'alerts')    showAlert(data);\n  if (channel === 'portfolio') updatePortfolio(data);\n};\n\nws.send(JSON.stringify({\n  action: 'subscribe',\n  channels: ['signals', 'prices', 'alerts', 'portfolio', 'heartbeat'],\n}));"} />
          </section>
          <Divider />
          <section data-section id="database">
            <SectionTitle id="database" status="LIVE">Database Schema</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>Supabase PostgreSQL project <code className="text-xs px-1 py-0.5 rounded font-mono" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>ngwqsxhsfzzrdchclbzi</code> — 9 tables, Row Level Security enabled.</p>
            <Table headers={["Table","Key Columns","Purpose"]} rows={[
              ["signals","id, asset, direction, confidence, entry, takeProfit, stopLoss, regime, outcome","All research signals + outcome tracking"],
              ["user_profiles","wallet_address, telegram_id, encrypted_key, created_at","User identity + embedded wallet storage"],
              ["agent_logs","session_id, agent, input, output, duration_ms, cost_usd","Full per-agent execution audit log"],
              ["alerts","id, user_id, asset, target_price, direction, triggered_at","User-defined price alerts"],
              ["portfolio_snapshots","user_id, usdc, btc, eth, total_usd, snapshot_at","Hourly portfolio value snapshots"],
              ["trades","id, user_id, asset, side, qty, price, tx_hash, status","SoDEX order ledger"],
              ["ssi_scores","sector, score, verdict, computed_at","SSI sector score cache"],
              ["content_queue","id, asset, status, draft, published_at","Content pipeline state"],
              ["audit_log","user_id, action, metadata, ip_hash, ts","Security audit trail"],
            ]} />
          </section>
          <Divider />
          <section data-section id="api">
            <SectionTitle id="api" status="LIVE">API Reference</SectionTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>Backend base URL: <code className="text-xs px-1 py-0.5 rounded font-mono" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>https://your-backend.onrender.com</code>. All routes require no auth by default (rate-limited by IP). User routes require a valid JWT from Supabase auth.</p>
            <InfoBox>The <strong>/api/agents/orchestrate</strong> endpoint starts the full 5-agent pipeline. This is also triggered by the Telegram /research command and the cron scheduler every 4 hours.</InfoBox>
            <Table headers={["Method","Path","Description"]} rows={[
              ["GET","/api/health","Health check — returns status, uptime, version"],
              ["GET","/api/market","Live price snapshot for BTC, ETH, SOL"],
              ["GET","/api/signals","Last 20 signals, sorted by createdAt desc"],
              ["GET","/api/signals/track-record","Aggregate HIT/STOP/DRIFT/PENDING counts"],
              ["POST","/api/agents/orchestrate","Trigger full research pipeline { asset }"],
              ["GET","/api/agents/status","Current orchestrator state + last run time"],
              ["GET","/api/ssi/:sector","SSI score for a single sector"],
              ["GET","/api/ssi/all","All 13 sector scores"],
              ["GET","/api/risk/preflight","Trade preflight gate (query params)"],
              ["GET","/api/risk/status","Circuit breaker status + blocked assets"],
              ["GET","/api/etf","Bitcoin ETF AUM and flow summary"],
              ["GET","/api/macro","Upcoming macro calendar events"],
              ["GET","/api/news","Top crypto news from SoSoValue feed"],
              ["GET","/api/feeds","Full curated news feed"],
              ["GET","/api/fundraising","Recent VC fundraising rounds"],
              ["GET","/api/charts","Analysis chart data"],
              ["GET","/api/currencies","All tracked currencies with metadata"],
              ["GET","/api/alerts","User price alerts (JWT required)"],
              ["POST","/api/alerts","Create a new price alert (JWT required)"],
              ["GET","/api/audit","Audit log for authenticated user (JWT required)"],
              ["GET","/ws","WebSocket upgrade endpoint (port 10001)"],
            ]} />
          </section>
          <Divider />
          <section data-section id="deployment">
            <SectionTitle id="deployment" status="LIVE">Deployment</SectionTitle>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>SoSoMind uses a split deployment: backend on Render.com (always-on), frontend on Vercel (edge). Both are production-deployed.</p>
            <SubTitle id="deployment">Environment Variables</SubTitle>
            <CodeBlock lang="bash" code={"# Required — backend\nWALLET_ENCRYPT_KEY=<64-char hex>           # AES-256-GCM key for wallet encryption\nSODEX_CHAIN_ID=138565\nSODEX_PRIVATE_KEY=0x<key>\nSODEX_ADDRESS=0x<addr>\nSODEX_ACCOUNT_ID=<id>\nSOSOVALUE_API_KEY=SOSO-<key>\nSUPABASE_URL=https://<project>.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=<key>\nUPSTASH_REDIS_REST_URL=https://<...>.upstash.io\nUPSTASH_REDIS_REST_TOKEN=<token>\nTELEGRAM_BOT_TOKEN=<token>\nTELEGRAM_ALLOWED_CHAT_ID=<id>\n\n# AI providers (6-provider fallback chain)\nCEREBRAS_API_KEY=<key>   SAMBANOVA_API_KEY=<key>\nTOGETHER_API_KEY=<key>   OPENROUTER_API_KEY=<key>\nGROQ_API_KEY=<key>       GEMINI_API_KEY=<key>\n\n# Required — frontend (Next.js)\nNEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=<key>\nNEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com"} />
            <Table headers={["Service","Platform","URL"]} rows={[
              ["Backend API","Render.com (always-on)","https://your-backend.onrender.com:10000"],
              ["WebSocket","Render.com (always-on)","wss://your-backend.onrender.com:10001"],
              ["Frontend","Vercel (edge)","https://sosomind.vercel.app"],
              ["Database","Supabase","https://ngwqsxhsfzzrdchclbzi.supabase.co"],
            ]} />
          </section>
          <Divider />
          <section data-section id="roadmap">
            <SectionTitle id="roadmap" status="ROADMAP">Roadmap</SectionTitle>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              Current focus: mainnet launch and signal marketplace. The system is architecturally ready — only testnet-to-mainnet migration and marketplace contracts remain.
            </p>
            <Table headers={["Feature","Status","Notes"]} rows={[
              ["SoDEX Mainnet (chainId 286623)", <StatusBadge key="r" status="ROADMAP" />, "Waiting for mainnet gateway access"],
              ["Signal Marketplace", <StatusBadge key="r" status="ROADMAP" />, "On-chain signal subscription protocol"],
              ["Multi-user Auth", <StatusBadge key="r" status="ROADMAP" />, "Supabase auth + per-user portfolios"],
              ["Portfolio Analytics", <StatusBadge key="e" status="EVOLVING" />, "PnL charts + drawdown visualisation"],
              ["Mobile App", <StatusBadge key="r" status="ROADMAP" />, "React Native with Telegram mini-app"],
              ["Tax Reporting", <StatusBadge key="r" status="ROADMAP" />, "FIFO + HIFO gain/loss export"],
              ["Strategy Builder", <StatusBadge key="r" status="ROADMAP" />, "No-code custom signal rules"],
              ["Social Feed", <StatusBadge key="r" status="ROADMAP" />, "Publish signals to followers"],
              ["Additional Agents", <StatusBadge key="e" status="EVOLVING" />, "Options flow + on-chain agent planned"],
              ["Multi-DEX", <StatusBadge key="r" status="ROADMAP" />, "dYdX, GMX routing in addition to SoDEX"],
              ["Content Auto-Publish", <StatusBadge key="e" status="EVOLVING" />, "Pipeline ready, scheduling in progress"],
              ["Backtesting Engine", <StatusBadge key="r" status="ROADMAP" />, "Historical signal replay on price data"],
              ["Webhook Integrations", <StatusBadge key="r" status="ROADMAP" />, "Push signals to Discord, Slack, Notion"],
              ["Leaderboard", <StatusBadge key="r" status="ROADMAP" />, "Signal accuracy ranking across users"],
            ]} />
          </section>
          <div className="h-16" />
        </div>
      </main>
    </div>
  );
}