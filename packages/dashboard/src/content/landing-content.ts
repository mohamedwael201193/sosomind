/** Landing page copy — single source of truth aligned with SOSOMIND_DOCUMENTATION.md */

export const HERO_TAGLINE = "The Trustworthy Agentic Trading Loop";
export const HERO_SUB =
  "Live SoSoValue intelligence, explainable AI signals, risk preflight, and non-custodial EIP-712 execution on SoDEX Mainnet. Testnet available in Settings.";

export const NAV_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Integrations", href: "#integrations" },
  { label: "Track Record", href: "#track-record" },
  { label: "Docs", href: "/docs", external: true },
  { label: "Roadmap", href: "/roadmap", external: true },
  { label: "FAQ", href: "#faq" },
];

export const STATS = [
  { to: 35, suffix: "", fmt: "35", label: "SoSoValue API Methods" },
  { to: 13, suffix: "", fmt: "13", label: "SSI Sectors Scored" },
  { to: 286623, suffix: "", fmt: "286623", label: "SoDEX Mainnet Chain ID" },
  { to: 0, suffix: "%", fmt: "—", label: "Public Hit Rate" },
];

export const PARTNERS = [
  "SoSoValue",
  "SoDEX Mainnet",
  "SoDEX Testnet",
  "Supabase",
  "Render",
  "Vercel",
  "Upstash Redis",
  "ValueChain",
  "Telegram",
  "EIP-712",
];

export const FEATURES = [
  {
    icon: "Brain",
    title: "AI Research Pipeline",
    desc: "Multi-source research agent pulls SoSoValue, macro, ETF flows, news, and market data. Real synthesis with citations stored in Supabase.",
    size: "large",
    live: true,
  },
  {
    icon: "Zap",
    title: "Evidence-First Signals",
    desc: "Directional signals with confidence, entry, take-profit, stop-loss, invalidation thesis, and public HIT/STOP/DRIFT outcome tracking.",
    size: "large",
    live: true,
  },
  {
    icon: "Shield",
    title: "Risk Preflight Gate",
    desc: "Four-check gate before every trade: daily cap, concentration limit, ATR filter, and drawdown protection. Circuit breaker halts on loss streaks.",
    size: "medium",
    live: true,
  },
  {
    icon: "Wallet",
    title: "SoDEX Mainnet Trading",
    desc: "Non-custodial MetaMask EIP-712 signing via backend relay. Default profile: mainnet-limited ($100 max notional, kill switch armed).",
    size: "medium",
    live: true,
  },
  {
    icon: "BarChart3",
    title: "SSI Sector Intelligence",
    desc: "13 crypto sectors scored from fundraising velocity, institutional momentum, and 30-day trend. Basket routing to SoDEX proxy assets.",
    size: "medium",
    live: true,
  },
  {
    icon: "Globe2",
    title: "Macro Regime Engine",
    desc: "Live risk-on/risk-off score from ETF net flows, BTC momentum, and upcoming CPI/FOMC events. Breakdown bars on dashboard and /agents.",
    size: "small",
    live: true,
  },
  {
    icon: "Layers",
    title: "Portfolio Terminal",
    desc: "Real SoDEX spot balances, open orders, order history, and fills from mainnet or testnet depending on your environment selector.",
    size: "small",
    live: true,
  },
  {
    icon: "Radio",
    title: "Real-Time WebSocket",
    desc: "Live prices, orderbook, signals, and alerts over wss://backend/ws on the shared HTTP port. Auto-reconnect with health bar status.",
    size: "small",
    live: true,
  },
  {
    icon: "Send",
    title: "Telegram Bot",
    desc: "@SosoMindbot for research, signals, portfolio, macro, SSI, and testnet execution with embedded encrypted wallets.",
    size: "small",
    live: true,
  },
  {
    icon: "Activity",
    title: "Perps Read-Only",
    desc: "Funding rates, mark prices, open positions, and liquidation distance from SoDEX perps APIs. Execution not enabled until production-ready.",
    size: "small",
    live: true,
  },
  {
    icon: "BookOpen",
    title: "Track Record Ledger",
    desc: "Public outcome ledger with HIT, STOP, DRIFT, and PENDING badges. Hourly evaluation against live price feeds.",
    size: "small",
    live: true,
  },
  {
    icon: "Cpu",
    title: "MCP Tool Servers",
    desc: "mcp-sosovalue (35 tools) and mcp-sodex (19 tools) expose live APIs to Claude Desktop, Cursor, and any MCP client.",
    size: "small",
    live: true,
  },
];

export const AGENTS = [
  { name: "Orchestrator", icon: "Network", desc: "Coordinates research and execution tasks, enforces circuit breakers, logs to agent_logs, and broadcasts over WebSocket." },
  { name: "Research", icon: "Brain", desc: "Parallel fetch from 13+ SoSoValue and market sources. AI synthesis via 6-provider fallback chain when keys are configured." },
  { name: "Risk", icon: "Shield", desc: "Preflight gate: daily trade cap, 30% concentration limit, ATR volatility filter, drawdown protection." },
  { name: "Macro Overlay", icon: "Globe2", desc: "ETF flows, BTC 24h momentum, and macro calendar events produce a 0-100 risk score and regime classification." },
  { name: "Execution", icon: "Bolt", desc: "Limit-IOC SoDEX orders with slippage buffer. Dashboard relay signing; Telegram embedded wallets on testnet." },
];

export const DATA_SOURCES = [
  { name: "SoSoValue", tools: 35, type: "REST + MCP" },
  { name: "SoDEX Spot", tools: 12, type: "REST + WS" },
  { name: "SoDEX Perps", tools: 8, type: "REST + WS" },
  { name: "Macro Calendar", tools: 2, type: "REST" },
  { name: "ETF Flows", tools: 4, type: "REST" },
  { name: "Fundraising DB", tools: 2, type: "REST" },
  { name: "SSI Indices", tools: 4, type: "REST" },
  { name: "Crypto Stocks", tools: 3, type: "REST" },
  { name: "BTC Treasuries", tools: 2, type: "REST" },
  { name: "News Feed", tools: 4, type: "REST" },
  { name: "Binance/Kraken", tools: 3, type: "REST" },
  { name: "Supabase Realtime", tools: 1, type: "Realtime" },
];

export const EXECUTION_STEPS = [
  { step: "1", title: "Research", body: "AI agent fetches SoSoValue, macro, ETF, and market data for the asset." },
  { step: "2", title: "Signal", body: "Structured signal with confidence, entry, TP, SL, citations, and invalidation thesis." },
  { step: "3", title: "Risk gate", body: "Preflight checks concentration, daily cap, ATR, and circuit breaker state." },
  { step: "4", title: "Sign", body: "MetaMask signs EIP-712 typed data. Private key never leaves your wallet on dashboard." },
  { step: "5", title: "Execute", body: "Backend relay submits to SoDEX mainnet gateway. Audit trail in signed_orders table." },
  { step: "6", title: "Track", body: "Outcome evaluator marks HIT, STOP, or DRIFT on the public track record." },
];

export const FAQ_ITEMS = [
  {
    q: "What is SoSoMind?",
    a: "SoSoMind is a production agentic trading platform that connects live SoSoValue market intelligence to non-custodial SoDEX execution. It ships on Vercel (dashboard) and Render (backend) with real APIs, not demo data.",
  },
  {
    q: "Does SoSoMind trade on mainnet?",
    a: "Yes. The default environment is mainnet-limited (chainId 286623) with a $100 max notional per order, kill switch, and full risk preflight. You can switch to SoDEX testnet (chainId 138565) in Settings.",
  },
  {
    q: "How does wallet signing work?",
    a: "Dashboard trades use EIP-712 typed data signed in MetaMask or WalletConnect. The backend relay verifies your signature and forwards the order to SoDEX. Your private key never leaves your browser.",
  },
  {
    q: "How are signals generated?",
    a: "The Research Agent pulls 13+ live data sources, computes a baseline score, and optionally runs AI synthesis. Signals include direction, confidence, entry, take-profit, stop-loss, citations, and regime context.",
  },
  {
    q: "What is SSI?",
    a: "Sector Intelligence System scores 13 crypto sectors (DeFi, AI, Layer 1, Meme, etc.) using fundraising velocity, institutional momentum, and 30-day price trend. Verdicts route to SoDEX proxy assets.",
  },
  {
    q: "What does the risk engine check?",
    a: "Before every trade: daily trade cap, 30% max single-asset exposure, ATR volatility filter, and portfolio drawdown protection. A circuit breaker halts trading after consecutive losses.",
  },
  {
    q: "Is the Telegram bot live?",
    a: "Yes. @SosoMindbot supports research, signals, portfolio, macro, SSI, alerts, and testnet execution with AES-256-GCM encrypted embedded wallets.",
  },
  {
    q: "Where is it deployed?",
    a: "Dashboard at sosomind.vercel.app, backend at sosomind-backend.onrender.com, database on Supabase PostgreSQL, cache on Upstash Redis.",
  },
];

export const FOOTER_LINKS = {
  product: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Trade", href: "/trade" },
    { label: "Signals", href: "/signals" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Research", href: "/research" },
  ],
  resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Track Record", href: "/track-record" },
    { label: "System Status", href: "/status" },
    { label: "Roadmap", href: "/roadmap" },
    { label: "Methodology", href: "/methodology" },
  ],
  legal: [
    { label: "Risk Disclosure", href: "/methodology#risk" },
    { label: "Telegram Bot", href: "https://t.me/SosoMindbot" },
  ],
};

export const PRODUCTION_URLS = {
  dashboard: "https://sosomind.vercel.app",
  backend: "https://sosomind-backend.onrender.com",
  telegram: "https://t.me/SosoMindbot",
  sodexMainnet: "https://sodex.com",
  sodexTestnet: "https://testnet.sodex.com",
};
