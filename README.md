<div align="center">

# SoSoMind

**Research → Signals → Risk → Trade → Portfolio → Track Record**

[![Dashboard](https://img.shields.io/badge/dashboard-sosomind.vercel.app-f97316?style=flat-square)](https://sosomind.vercel.app)
[![Backend](https://img.shields.io/badge/API-sosomind--backend.onrender.com-46e3b7?style=flat-square)](https://sosomind-backend.onrender.com/api/health/live)
[![Telegram](https://img.shields.io/badge/bot-%40SosoMindbot-0088cc?style=flat-square&logo=telegram)](https://t.me/SosoMindbot)
[![SoDEX Mainnet](https://img.shields.io/badge/SoDEX-Mainnet%20%2B%20Testnet-22c55e?style=flat-square)](https://sodex.com)
[![Docs](https://img.shields.io/badge/full%20docs-SOSOMIND_DOCUMENTATION.md-6366f1?style=flat-square)](#documentation)

Real SoDEX Mainnet trading · Non-custodial EIP-712 execution · Live SoSoValue intelligence · Public outcome ledger

</div>

---

## What is SoSoMind?

SoSoMind is a **production agentic trading platform** that closes the loop between market intelligence and on-chain execution. Every recommendation is evidence-backed, every trade passes a risk gate, and every outcome is tracked publicly.

| Principle | In practice |
|-----------|-------------|
| **Evidence first** | Signals carry citations, confidence explanations, and invalidation theses |
| **Risk gated** | 4-check preflight + circuit breaker before any order reaches SoDEX |
| **Non-custodial** | Dashboard trades sign in MetaMask via EIP-712 relay |
| **Environment aware** | Mainnet-limited by default; testnet opt-in in Settings |
| **No mock data** | When data is unavailable, the UI shows **Unavailable** |

**Full reference:** [SOSOMIND_DOCUMENTATION.md](./SOSOMIND_DOCUMENTATION.md) (Wave 3, July 2026)

---

## Live surfaces

| Surface | URL | Role |
|---------|-----|------|
| **Dashboard** | [sosomind.vercel.app](https://sosomind.vercel.app) | Web terminal (Vite + React 19) |
| **Backend API** | [sosomind-backend.onrender.com](https://sosomind-backend.onrender.com) | Express + agents + relay |
| **Telegram** | [@SosoMindbot](https://t.me/SosoMindbot) | Mobile research + testnet execution |
| **SoDEX Mainnet** | [sodex.com](https://sodex.com) | Default execution (chainId `286623`) |
| **SoDEX Testnet** | [testnet.sodex.com](https://testnet.sodex.com) | Optional via Settings (chainId `138565`) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                                 │
│  Vercel Dashboard  │  Telegram Bot  │  MCP (Cursor / Claude)           │
└─────────┬──────────────────┬──────────────────────┬─────────────────────┘
          │ HTTPS + JWT      │ grammY               │ stdio MCP
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Render Backend (port 10000, always-on)                                  │
│  Express REST  │  WebSocket /ws  │  Agent Pipeline  │  Cron Jobs       │
└─────────┬──────────────────┬──────────────────────┬─────────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐
│ SoSoValue    │  │ SoDEX GW     │  │ Supabase PostgreSQL + Upstash    │
│ 35 API methods│  │ Mainnet/Test │  │ Redis cache                       │
└──────────────┘  └──────────────┘  └──────────────────────────────────┘
```

### Agent pipeline

```
Orchestrator → Research (13+ sources) → Risk (4 checks) → Macro Overlay → Execution
```

**AI fallback chain:** Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini

---

## Production features

### Trading & execution

- **SoDEX Mainnet trading** — default profile `mainnet-limited`, $100 notional cap per order
- **4-step trade wizard** — Strategy → Risk Preflight → EIP-712 Sign → Execution Proof
- **Non-custodial relay** — `POST /api/sodex/relay` with MetaMask typed-data signing
- **Limit + IOC orders** — market-style fills with slippage buffer (+0.5% buy / -0.5% sell)
- **Sell balance guard** — blocks sells above available balance (fee reserved)
- **Relay audit trail** — every order logged in `signed_orders`; merged into trade/portfolio history
- **Live status polling** — timeline endpoint refreshes fill status from SoDEX

### Intelligence

- **AI Research** — parallel SoSoValue + market fetches, multi-provider synthesis
- **Evidence-first signals** — citations, confidence bands, invalidation thesis
- **Track Record** — public HIT / STOP / DRIFT outcome ledger (`/track-record`)
- **SSI 13-sector scoring** — DeFi, AI, L1, L2, RWA, MAG7, Meme, and more
- **Macro Regime panel** — ETF flows, BTC momentum, macro safety, composite score (0–100)
- **Portfolio Terminal** — live balances, open orders, history, fills from SoDEX API

### Infrastructure

- **Environment profiles** — `mainnet-limited` (default), `testnet`, `mainnet-readonly`
- **Health monitoring** — live probes, circuit breakers, SoSoValue failover keys
- **WebSocket feeds** — prices, orderbook, signals, alerts on `wss://…/ws`
- **MCP servers** — 35 SoSoValue tools + 19 SoDEX tools for AI assistants
- **Telegram bot** — research, signals, testnet trade, embedded wallet (encrypted)

### Labs (preview)

Arbitrage, Whales, Persona, Playbook, Rebalance, Strategies, Leaderboard — preview quality with banner shown in UI.

---

## Dashboard routes

| Route | Purpose |
|-------|---------|
| `/` | Landing (marketing, production-accurate copy) |
| `/dashboard` | Overview hub + user journey |
| `/trade` | 4-step non-custodial trading wizard |
| `/portfolio` | Balances, orders, fills |
| `/signals` | AI signal feed |
| `/research` | On-demand asset analysis |
| `/sectors` | SSI sector intelligence |
| `/agents` | Macro Regime scoring + breakdown |
| `/track-record` | Public outcome ledger |
| `/perps` | Perps read-only terminal |
| `/settings` | Mainnet / Testnet switch |
| `/docs` | In-app API reference |
| `/status` | System health |

---

## Trading flow (dashboard)

1. **Connect wallet** — Reown AppKit / MetaMask
2. **Choose strategy** — Copy Signal, Follow SSI Basket, or Manual Order
3. **Preflight** — wallet, balance, min notional, market status, risk checks
4. **Sign EIP-712** — client-side typed data in MetaMask
5. **Relay submit** — backend verifies signature, forwards to SoDEX gateway
6. **Execution proof** — poll audit timeline; link to SoDEX Portfolio for fills

Spot orders settle on the **SoDEX appchain** (not ValueChain EVM explorer). Proof links point to [SoDEX Portfolio → Order History](https://sodex.com/portfolio).

---

## Risk & safety

| Layer | Mechanism |
|-------|-----------|
| **Preflight** | Daily cap, concentration (30%), ATR filter, drawdown halt |
| **Circuit breaker** | 3 global losses → 1h halt; 2 per-asset → 24h block |
| **Kill switch** | `KILL_SWITCH_TRADING=true` halts all trading instantly |
| **Notional cap** | $100/order on `mainnet-limited` profile |
| **Rate limits** | 120 req/min global, 30 relay/min per wallet |
| **Production guards** | Strong `JWT_SECRET` + `WALLET_ENCRYPT_KEY` required |

---

## Repository structure

```
sosomind/
├── packages/
│   ├── backend/           Express API, agents, bot, WebSocket, cron
│   │   └── src/
│   │       ├── agents/    Research, Risk, Execution, Macro, SSI
│   │       ├── routes/    REST + sodex-relay + trading timeline
│   │       ├── clients/   SoSoValue, SoDEX, AI (6-provider chain)
│   │       ├── bot/       grammY Telegram bot
│   │       └── ws/        WebSocket server
│   ├── dashboard/         Vite 6 + React 19 + Tailwind 4
│   │   └── src/app/       Pages: trade, portfolio, agents, landing, …
│   ├── mcp-sosovalue/     35 MCP tools
│   └── mcp-sodex/         19 MCP tools
├── render.yaml            Render backend + heartbeat cron
├── SOSOMIND_DOCUMENTATION.md   Full production reference
└── README.md              This file
```

---

## Quick start

### Prerequisites

- Node.js 20+
- Supabase project
- SoSoValue API key (`SOSO-...`)
- SoDEX wallet + account (for trading)

### Local development

```bash
git clone https://github.com/mohamedwael201193/sosomind.git
cd sosomind
npm install

# Backend
cp packages/backend/.env.example packages/backend/.env   # add your keys
cd packages/backend && npm run dev
# → http://localhost:10000

# Dashboard (new terminal)
cp packages/dashboard/.env.example packages/dashboard/.env.local
# VITE_API_URL=http://localhost:10000
cd packages/dashboard && npm run dev
# → http://127.0.0.1:3000

# Verify
curl http://localhost:10000/api/health/live
```

### Production deploy

| Service | Platform | Trigger |
|---------|----------|---------|
| Backend | [Render](https://render.com) | Push to `main` → `render.yaml` |
| Dashboard | [Vercel](https://vercel.app) | Push to `main` → `packages/dashboard` |

---

## API quick reference

**Base:** `https://sosomind-backend.onrender.com`

**Headers:**
- `X-SoSoMind-Environment: mainnet|testnet` (dashboard sends automatically)
- `Authorization: Bearer <jwt>` (wallet-authenticated routes)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health/live` | Fast liveness probe |
| GET | `/api/config/environment` | Active profile + trading controls |
| POST | `/api/agents/research/:asset` | Run research pipeline |
| GET | `/api/agents/macro` | Macro regime outlook (cached 90s) |
| GET | `/api/signals/track-record` | HIT/STOP/DRIFT counts |
| GET | `/api/public/signals` | Public track record (landing) |
| GET | `/api/risk/preflight` | Trade preflight gate |
| POST | `/api/sodex/relay` | EIP-712 order relay (JWT) |
| GET | `/api/trading/orders/:id/timeline` | Order audit + live status |
| GET | `/api/sodex/user/:address/balances` | Spot balances |

Interactive reference: [sosomind.vercel.app/docs](https://sosomind.vercel.app/docs)

---

## WebSocket

**URL:** `wss://sosomind-backend.onrender.com/ws`

```json
{ "subscribe": "prices" }
```

| Channel | Frequency | Data |
|---------|-----------|------|
| `prices` | 15s | BTC / ETH / SOL snapshots |
| `orderbook` | 10s | BTC_vUSDC depth |
| `signals` | 30s + realtime | Latest signals |
| `alerts` | 60s | Triggered alerts |

---

## MCP integration

### SoSoValue (35 tools)

```json
{
  "mcpServers": {
    "sosovalue": {
      "command": "node",
      "args": ["packages/mcp-sosovalue/dist/index.js"]
    }
  }
}
```

Modules: Currencies, ETF, Indices, Crypto Stocks, BTC Treasuries, News, Fundraising, Macro, Analysis.

### SoDEX (19 tools)

Spot/perps reads, account balances, and EIP-712 write tools (`place_spot_order`, etc.).

---

## Environment variables

<details>
<summary><strong>Backend (Render)</strong></summary>

```bash
# Core
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://sosomind.vercel.app
CORS_ALLOWED_ORIGINS=https://sosomind.vercel.app

# SoSoValue
SOSO_API_KEY=SOSO-...
SOSO_BASE_URL=https://openapi.sosovalue.com/openapi/v1

# SoDEX
SODEX_CHAIN_ID=286623
SODEX_MAINNET_URL=https://mainnet-gw.sodex.dev/api/v1
SODEX_TESTNET_URL=https://testnet-gw.sodex.dev/api/v1
SOSOMIND_DEFAULT_PROFILE=mainnet-limited
TRADING_MAX_NOTIONAL_USD=100
KILL_SWITCH_TRADING=false

# Database + cache
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Auth + security
JWT_SECRET=...
WALLET_ENCRYPT_KEY=...

# AI (6-provider chain)
CEREBRAS_API_KEY=...
SAMBANOVA_API_KEY=...
TOGETHER_API_KEY=...
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
GEMINI_API_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=...
```

</details>

<details>
<summary><strong>Frontend (Vercel)</strong></summary>

```bash
VITE_API_URL=https://sosomind-backend.onrender.com
VITE_DEFAULT_ENVIRONMENT=mainnet
VITE_REOWN_PROJECT_ID=...
```

</details>

---

## Documentation

| Document | Contents |
|----------|----------|
| **[SOSOMIND_DOCUMENTATION.md](./SOSOMIND_DOCUMENTATION.md)** | Complete production reference (31 sections) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture deep-dive |
| [In-app docs](https://sosomind.vercel.app/docs) | Interactive API reference |

---

## Recent updates (Wave 3)

| Area | Change |
|------|--------|
| **Mainnet** | Production default `mainnet-limited`; real SoDEX Mainnet trading |
| **Landing** | Full rewrite from production docs; root URL opens landing |
| **Macro Regime** | Premium radial gauge, parallel ETF fetches, 90s API cache |
| **Sell orders** | Balance guard, limit+IOC market path, relay rejection detection |
| **Health** | Live endpoint fallback, SoSoValue failover status fix |
| **Overview** | User journey flow with animated SVG diagrams |
| **Research** | Real AI analysis with premium click-to-analyze UX |
| **History** | Relay audit orders merged with SoDEX order history |
| **Docs** | `SOSOMIND_DOCUMENTATION.md` as single source of truth |

---

## Production limitations

| Limit | Detail |
|-------|--------|
| Mainnet notional | $100 per order (`mainnet-limited`) |
| Perps execution | Read-only UI |
| Aggregate spot PnL | Not exposed by SoDEX API |
| Telegram mainnet | Execution disabled; use dashboard + MetaMask |
| Labs pages | Preview quality |

---

## Contributing

1. TypeScript strict — `npm run build` in affected packages
2. Real APIs only — no mocks or hardcoded demo data on production surfaces
3. Match [SOSOMIND_DOCUMENTATION.md](./SOSOMIND_DOCUMENTATION.md) for behavior claims
4. Test against live SoSoValue + SoDEX before PR

---

## License

Private — all rights reserved.

---

<div align="center">

**Built for traders who want evidence, not hype.**

[Dashboard](https://sosomind.vercel.app) · [Telegram](https://t.me/SosoMindbot) · [Full Docs](./SOSOMIND_DOCUMENTATION.md) · [Track Record](https://sosomind.vercel.app/track-record)

</div>
