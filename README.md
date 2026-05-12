<div align="center">

# SoSoMind

**The Agentic Finance OS for Serious Crypto Traders**

[![Live](https://img.shields.io/badge/dashboard-sosomind.vercel.app-f97316?style=flat-square)](https://sosomind.vercel.app)
[![Bot](https://img.shields.io/badge/telegram-%40sosomind__bot-0088cc?style=flat-square&logo=telegram)](https://t.me/sosomind_bot)
[![Backend](https://img.shields.io/badge/backend-render.com-46e3b7?style=flat-square)](https://render.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)

Multi-agent AI research · Real-time sector intelligence · EIP-712 DEX execution · Telegram trading bot

</div>

---

## Overview

SoSoMind is an agentic finance intelligence platform that synthesises live market data from 13 sources, runs it through a coordinated system of specialist AI agents, surfaces high-confidence trading signals, and executes orders directly on SoDEX via EIP-712 non-custodial signing — all accessible from a Next.js dashboard, a Telegram bot, or an AI assistant via MCP tools.

**Current deployment status:** Active testnet (SoDEX Testnet, chainId=138565). Backend live on Render, dashboard live on Vercel. Bot is reachable at [@sosomind\_bot](https://t.me/sosomind_bot).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT SURFACES                                   │
│                                                                              │
│   Next.js Dashboard          MCP Clients           Telegram App              │
│   sosomind.vercel.app        (Claude / Cursor)      @sosomind_bot            │
│   React 19 + TypeScript      stdio transport        grammY + EIP-712         │
└────────┬──────────────────────────┬─────────────────────────┬───────────────┘
         │ HTTPS/REST               │ MCP stdio               │ Bot Webhook
         ▼                          ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND  (Express · Node 20 · TypeScript)                 │
│                    Render.com · Port 10000 · Port 10001 (WS)                 │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │ Orchestrator│  │ Research    │  │ Risk Engine │  │ Macro Overlay   │    │
│  │ Agent       │  │ Agent       │  │ (4-check)   │  │ Agent           │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘    │
│         │                │                │                   │             │
│  ┌──────▼──────────────────────────────────────────────────────▼────────┐   │
│  │                     ROUTE LAYER (30+ endpoints)                      │   │
│  │  /agents  /signals  /sectors  /trades  /portfolio  /macro  /health  │   │
│  │  /currencies  /etf  /news  /fundraising  /audit  /stats  /sodex     │   │
│  └──────┬──────────────────────────────────────────────────────┬────────┘   │
│         │                                                       │            │
│  ┌──────▼──────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────▼──────┐    │
│  │ SoSoValue   │  │ SoDEX       │  │ AI Client   │  │ Supabase       │    │
│  │ Client      │  │ EIP-712     │  │ 6-provider  │  │ 9 tables       │    │
│  │ 35 methods  │  │ Client      │  │ fallback    │  │ PostgreSQL     │    │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └────────────────┘    │
└─────────┼────────────────┼─────────────────────────────────────────────────┘
          │                │
┌─────────▼────┐  ┌────────▼──────────┐
│ SoSoValue API│  │ SoDEX Testnet     │
│ 9 modules    │  │ testnet-gw.sodex  │
│ 35 endpoints │  │ EIP-712 signed    │
└──────────────┘  └───────────────────┘
```

---

## Repository Structure

```
sosomind/
├── packages/
│   ├── backend/              Express API + Agent System
│   │   └── src/
│   │       ├── server.ts     Entry point, route registration, background tasks
│   │       ├── agents/       Orchestrator, Research, Risk, CircuitBreaker,
│   │       │                 Execution, SectorRotation, MacroOverlay
│   │       ├── routes/       30+ Express route modules
│   │       ├── clients/      SoSoValue (35 EP), SoDEX (EIP-712), AI (6-chain),
│   │       │                 Redis, OpenAI
│   │       ├── bot/          grammY Telegram bot — wallet, trading, commands
│   │       ├── ws/           WebSocket server :10001 (5 live channels)
│   │       ├── cron/         Heartbeat (5m), AnomalyScanner (4h)
│   │       ├── content/      Autonomous briefing generation + publishing
│   │       └── db/           Supabase typed CRUD, migrations
│   │
│   ├── dashboard/            Next.js 14 + React 19 + TailwindCSS
│   │   └── src/
│   │       ├── app/          Pages: landing, trade, signals, sectors, macro,
│   │       │                 research, portfolio, roadmap, docs, methodology
│   │       ├── components/   SpotlightCard, MagneticButton, Logo, Charts
│   │       ├── context/      WalletContext, ThemeContext
│   │       └── lib/          api.ts (axios), websocket.ts
│   │
│   ├── mcp-sosovalue/        35 MCP tools over stdio (all 9 SoSoValue modules)
│   ├── mcp-sodex/            25 MCP tools over stdio (spot, perps, account, writes)
│   └── openclaw-skills/      5 OpenClaw SKILL.md packs
│
├── skills/                   Mirrored skills (market-research, portfolio-briefing,
│                             risk-monitor, trade-execution, content-studio)
├── docker-compose.yml        Orchestrates backend + dashboard containers
├── render.yaml               Render.com service definition
├── vercel.json               Vercel deployment config
└── ARCHITECTURE.md           Full system architecture reference
```

---

## Features

### Core Trading Capabilities

| Feature | Description | Status |
|---|---|---|
| **NLP Intent Trading** | Type in plain English, execute with precision | ✅ Live |
| **Signal Marketplace** | Curated signal streams with live performance tracking | ✅ Live |
| **Copy Signal** | Copy high-confidence AI research signals to trade | ✅ Live |
| **SSI Basket Trading** | Trade top sector basket assets via ETH/BTC proxy | ✅ Live |
| **Manual Order** | Direct limit/market order entry on SoDEX | ✅ Live |
| **Arbitrage Scanner** | Cross-exchange spread detection with slippage paths | 🔧 Partial |
| **Whale Tracker** | On-chain wallet movement alerts | 🔧 Partial |
| **Portfolio Rebalancer** | Target allocation auto-rebalancing | ✅ Live |
| **Paper Trading** | Full simulation with live prices | 🔧 Partial |
| **Confluence Engine** | 5+ signal combination for high-confidence ideas | ✅ Live |
| **Voice Trading** | ElevenLabs voice command execution | 🔧 Partial |
| **Kelly Criterion** | Optimal position sizing by edge + risk tolerance | ✅ Live |
| **Social Sentiment** | Twitter/X, Telegram, Reddit aggregation | 🔧 Partial |
| **Tax Reporting** | Capital gains reports, FIFO accounting | 🔧 Partial |
| **MEV Protection** | MEV-resistant RPC routing | 🔧 Partial |
| **Trader Persona** | AI-built risk profile from trading history | ✅ Live |
| **Funding Signals** | Perpetual funding rate monitoring | ✅ Live |
| **Macro Playbook** | Regime-aware strategy selection | ✅ Live |

### Intelligence Layer

| System | Description |
|---|---|
| **Sector Intelligence (SSI)** | 13 crypto sectors scored 0–100 (S1 + S2 + S3 composite) |
| **Signal Outcome Tracker** | Automated HIT/STOP/DRIFT classification |
| **My Edge Analytics** | Per-user win rate, peak hours, asset performance |
| **Smart-Money Brief** | AI-generated daily market newsletter |
| **Macro Overlay** | ETF flows + macro events + BTC momentum → risk regime |

---

## Agent System

| Agent | Role | Confidence |
|---|---|---|
| **Orchestrator** | Routes intent to specialist agents, enforces circuit breakers | Central |
| **Research** | 13+ parallel data sources → AI synthesis → structured signal | ✅ |
| **Risk** | 4-check gatekeeper: daily cap, concentration, ATR, drawdown | ✅ |
| **CircuitBreaker** | Consecutive loss tracking, per-asset 24h blocks | ✅ |
| **Execution** | EIP-712 limit+IOC order placement on SoDEX | ✅ |
| **SectorRotation** | Fundraising + price + news momentum scoring | ✅ |
| **MacroOverlay** | Risk regime: `risk-on` / `risk-off` / `neutral` | ✅ |

### AI Provider Fallback Chain

```
Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini
```

Each provider has cooldown tracking (429/5xx → 30s, 4xx → 5 min). 5-min Redis cache per prompt hash.

---

## Data Sources

| Source | Tools | Type | Module |
|---|---|---|---|
| **SoSoValue** | 35 | REST + MCP | Currencies, ETF, Indices, Stocks, BTC Treasuries, News, Fundraising, Macro, Analysis |
| **SoDEX** | 25 | REST + MCP + EIP-712 | Spot, Perps, Account, Writes |
| Macro Events | 8 | Feed | FOMC, CPI, Non-Farm, Fed speeches |
| ETF Flows | 7 | Feed | BTC/ETH ETF daily/weekly flows |
| Sector Indices | 8 | Feed | 13 SSI sector composites |
| BTC Treasuries | 4 | Feed | Corporate BTC holdings |
| Crypto Stocks | 6 | REST | MSTR, COIN, RIOT, CLSK, etc. |
| News Feed | 11 | AI | Hot news, featured, search |
| Fundraising DB | 6 | Feed | VC rounds, token sales |

---

## MCP Tools

SoSoMind ships two MCP servers for AI assistant integration (Claude Desktop, Cursor, VS Code).

### mcp-sosovalue (35 tools)

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

| Module | Tools |
|---|---|
| Currencies | `get_currencies`, `get_currency_info`, `get_market_snapshot`, `get_token_economics`, `get_klines`, `get_supply`, `get_pairs`, `get_sector_spotlight`, `get_currency_fundraising` |
| ETF | `get_etf_list`, `get_etf_summary_history`, `get_etf_market_snapshot`, `get_etf_history` |
| Indices | `get_indices`, `get_index_constituents`, `get_index_market_snapshot`, `get_index_klines` |
| Crypto Stocks | `get_crypto_stock_list`, `get_crypto_stock_snapshot`, `get_crypto_stock_market_cap`, `get_crypto_stock_klines`, `get_crypto_stock_sectors`, `get_crypto_sector_index` |
| BTC Treasuries | `get_btc_treasuries`, `get_btc_purchase_history` |
| News | `get_news_feed`, `get_hot_news`, `get_featured_news`, `search_news` |
| Fundraising | `get_fundraising_projects`, `get_fundraising_project_detail` |
| Macro | `get_macro_events`, `get_macro_event_history` |
| Analysis | `get_analysis_charts`, `get_analysis_chart_data` |

### mcp-sodex (25 tools)

```json
{
  "mcpServers": {
    "sodex": {
      "command": "node",
      "args": ["packages/mcp-sodex/dist/index.js"]
    }
  }
}
```

| Category | Tools |
|---|---|
| Spot Reads | `get_spot_symbols`, `get_spot_tickers`, `get_spot_orderbook`, `get_spot_trades`, `get_spot_klines` |
| Perps Reads | `get_perps_symbols`, `get_perps_mark_prices`, `get_perps_orderbook`, `get_perps_klines`, `get_perps_trades` |
| Account | `get_account_balances`, `get_perps_balances`, `get_perps_positions`, `get_spot_orders`, `get_perps_orders` |
| Writes | `place_spot_order`, `cancel_spot_order`, `place_perps_order`, `cancel_perps_order` |

All write tools use EIP-712 non-custodial signing.

---

## OpenClaw Skills

Five domain-specific SKILL.md packs in `packages/openclaw-skills/`:

| Skill | Trigger | Key MCP Tools Used |
|---|---|---|
| `market-research` | "Research BTC" / "What's the outlook for ETH?" | `get_market_snapshot`, `get_sector_spotlight`, `get_macro_events`, `get_hot_news` |
| `portfolio-briefing` | "Morning briefing" / "Portfolio summary" | `get_etf_history`, `get_index_market_snapshot`, `get_crypto_stock_snapshot` |
| `risk-monitor` | "Check my risk" / "Any danger signals?" | `get_market_snapshot`, `get_macro_events`, circuit breaker state |
| `trade-execution` | "Buy 0.01 BTC" / "Execute long ETH" | `place_spot_order`, `get_spot_orderbook`, EIP-712 sign |
| `content-studio` | "Generate market brief" / "Publish daily report" | `get_sector_spotlight`, `get_hot_news`, `get_etf_summary_history` |

---

## Backend API Reference

Base URL: `https://api.sosomind.app` (Render) or `http://localhost:10000`

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents/signals` | Fetch latest AI signals from Supabase |
| `POST` | `/api/agents/research/:asset` | Generate signal for asset on-demand |
| `GET` | `/api/agents/macro` | Get macro regime classification |
| `GET` | `/api/signals/track-record` | Public win/loss statistics |

### Market Data (via SoSoValue)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/currencies/snapshot?symbol=BTC` | Live price + volume |
| `GET` | `/api/etf/list?symbol=BTC&country_code=US` | ETF products |
| `GET` | `/api/macro/events` | Upcoming macro events |
| `GET` | `/api/news/hot` | Hot crypto news |
| `GET` | `/api/sectors/intel` | All 13 SSI sectors scored |
| `GET` | `/api/sectors/intel/:ticker/basket` | Top 3 assets for sector |

### SoDEX (Testnet)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sodex/spot/symbols` | All spot markets |
| `GET` | `/api/sodex/spot/orderbook?market=vBTC_vUSDC&depth=5` | Live orderbook |
| `GET` | `/api/sodex/account/balances` | Wallet balances |

### Operations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Full service health (backend, SoSoValue, SoDEX, AI, Supabase, Telegram) |
| `GET` | `/api/audit/logs` | Paginated agent activity logs |
| `GET` | `/api/stats/accuracy` | Signal accuracy metrics |
| `GET` | `/api/stats/performance` | Portfolio performance |

---

## WebSocket Server

Port `:10001`. Subscribe with `{"subscribe": "channel"}`.

| Channel | Push Interval | Data |
|---|---|---|
| `prices` | 15s | BTC/ETH/SOL live prices |
| `orderbook` | 10s | SoDEX vBTC_vUSDC top 10 levels |
| `signals` | 30s | Latest 5 AI signals |
| `alerts` | 60s | Triggered alerts (last 5) |

```javascript
const ws = new WebSocket('wss://api.sosomind.app/ws')
ws.send(JSON.stringify({ subscribe: 'prices' }))
ws.onmessage = (e) => console.log(JSON.parse(e.data))
// → { channel: 'prices', ts: 1720000000000, data: [...] }
```

---

## Telegram Bot

**[@sosomind\_bot](https://t.me/sosomind_bot)** — full trading interface from any device.

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome + persistent reply keyboard |
| `/research [asset]` | Deep AI research on any crypto asset |
| `/signal [asset]` | Live signal with entry, TP, SL, confidence |
| `/trade [asset]` | Execute spot order on SoDEX |
| `/basket` | SSI sector basket trading |
| `/methodology` | Signal scoring explanation |
| `/wallet` | View embedded wallet address + balance |
| `/setup` | Full account setup flow |
| `/portfolio` | Positions + recent trades |
| `/briefing` | AI-generated daily market brief |
| `/macro` | Macro regime + upcoming events |
| `/sector` | SSI sector scores |
| `/track_record` | Signal win/loss history |
| `/intel` | Sector intelligence dashboard |

### Embedded Wallet System

Every user gets a non-custodial EVM wallet created on first `/start`:
- AES-256-GCM encrypted with `WALLET_ENCRYPT_KEY`
- EIP-712 non-custodial signing (private key never leaves backend)
- Stores wallet address in `telegram_wallets` Supabase table
- Reset flow if decrypt fails (user can trigger with confirmation)

---

## Database Schema (Supabase)

| Table | Purpose |
|---|---|
| `signals` | AI-generated trading signals with direction, confidence, entry/TP/SL, outcome |
| `telegram_wallets` | Per-user encrypted embedded wallets |
| `agent_logs` | Timestamped agent activity + results |
| `agent_meta` | Key-value store for agent state (win rates, track record) |
| `user_profiles` | Trader persona, preferences, risk settings |
| `trades` | Trade history with fill details |
| `alerts` | User-configured price alerts |
| `content_posts` | Published briefings + channel posts |
| `portfolio_snapshots` | Daily portfolio value snapshots |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- SoSoValue API key (`SOSO-...`)
- Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/your-org/sosomind.git
cd sosomind
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys (see Environment Variables below)

# 3. Apply Supabase migrations
# Open: https://supabase.com/dashboard/project/<your-project>/sql/new
# Run: packages/backend/supabase/migrations/001_init.sql

# 4. Start backend
cd packages/backend
npm run dev
# Backend runs on :10000, WebSocket on :10001

# 5. Start dashboard (new terminal)
cd packages/dashboard
npm run dev
# Dashboard runs on :3000

# 6. Verify
curl http://localhost:10000/api/health
```

### Production (Docker)

```bash
docker compose up -d --build
# Backend: :10000, Dashboard: :3000
```

### Deploy to Render + Vercel

**Backend (Render):** Push to main → Render auto-deploys from `render.yaml`

**Dashboard (Vercel):**
```bash
cd packages/dashboard
vercel --prod
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOSOVALUE_API_KEY` | ✅ | SoSoValue API key (`SOSO-...`) |
| `SODEX_CHAIN_ID` | ✅ | `138565` (testnet) or `286623` (mainnet) |
| `SODEX_PRIVATE_KEY` | ✅ | Trading wallet private key (0x...) |
| `SODEX_ADDRESS` | ✅ | Trading wallet address |
| `SODEX_ACCOUNT_ID` | ✅ | SoDEX account ID (from `/accounts/{addr}/state`) |
| `WALLET_ENCRYPT_KEY` | ✅ | AES-256-GCM key for Telegram wallet encryption |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from BotFather |
| `TELEGRAM_ALLOWED_CHAT_ID` | ✅ | Your private Telegram chat ID |
| `TELEGRAM_CHANNEL_ID` | Optional | Channel ID for publishing briefings |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `REDIS_URL` | ✅ | Upstash Redis URL |
| `DASHBOARD_URL` | ✅ | Public dashboard URL |
| `OPENAI_API_KEY` | Optional | OpenAI key (GPT-4o fallback) |
| `GROQ_API_KEY` | Optional | Groq key (Llama fallback) |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key (multi-model) |
| `DRY_RUN` | Optional | Set `true` to block live trades |

---

## Risk Management

### Risk Agent (4-check Gatekeeper)

| Check | Threshold | Response |
|---|---|---|
| Daily trade cap | 10 trades/day | `REJECTED` |
| Portfolio concentration | 30% max per asset | `ADJUSTED` (reduced size) |
| ATR volatility filter | >15% ATR | `REJECTED` |
| Daily drawdown | <-5% of portfolio | `HALT` |

### Circuit Breaker

- **Global:** 3 consecutive losses → 1h trading pause
- **Per-asset:** >2 losses in 24h OR >15% price drop → 24h asset block
- Manual reset via API: `POST /api/agents/circuit-breaker/reset`

### SoDEX Order Safety

- Market orders are forbidden (use limit+IOC to avoid oracle price errors)
- `DRY_RUN=true` blocks all live write calls
- Min notional: 5 USDC per order
- All quantities: 8 decimal places, no trailing zeros
- Retry-doubled-qty: automatic single retry on quantity rejection

---

## Sector Intelligence System (SSI)

13 crypto sectors, each scored 0–100 from three signals:

| Signal | Weight | Source |
|---|---|---|
| S1 — ETF Flows | 30% | BTC/ETH ETF 7-day flow |
| S2 — Sector Momentum | 35% | `getIndexMarketSnapshot(ticker)` roi_7d |
| S3 — Sector Trend | 35% | `getIndexKlines(ticker, limit:30)` 30-day price trend |

**Verdict thresholds:** STRONG_BUY ≥75 · BUY ≥55 · NEUTRAL ≥35 · SELL <35

**Sectors:** `ssiDeFi` · `ssiAI` · `ssiLayer1` · `ssiLayer2` · `ssiRWA` · `ssiNFT` · `ssiMeme` · `ssiGameFi` · `ssiMAG7` · `ssiPayFi` · `ssiCeFi` · `ssiSocialFi` · `ssiDePIN`

**Cache:** 5-min Redis TTL. Force refresh: `GET /api/sectors/intel?refresh=1`

---

## SoDEX Integration Notes

| Detail | Value |
|---|---|
| Testnet base URL | `https://testnet-gw.sodex.dev/api/v1` |
| Chain ID | `138565` |
| Auth | EIP-712 headers: `X-API-Sign`, `X-API-Nonce`, `X-API-Chain` |
| EIP-712 Domain | `{name:"spot"|"futures", version:"1", chainId, verifyingContract:0x000...}` |
| payloadHash | `keccak256(JSON({type:actionName, params:body}))` |
| Spot symbols | `vBTC_vUSDC` (id=1), `vETH_vUSDC` (id=2), `TESTBTC_vUSDC` (id=18) |
| BTC price precision | 0 (integer string prices only) |
| BTC quantity precision | 5 decimal places |
| Order type | Limit+IOC (type=1, timeInForce=3) |

---

## Commit History (Recent)

| Commit | Description |
|---|---|
| `ba75c07` | Rev 47: Copy Signal live-generates; SSI Basket proxy |
| `cbf1f68` | Rev 46e: Multi-field qty fallbacks + retry-doubled-qty |
| `785f93a` | Rev 46d: marketMinQuantity enforcement + 8dp precision |
| `2a6fd87` | Rev 46c: Dynamic market resolution + inline wallet balance |
| `4310b6f` | Rev 46b: Auto-register SoDEX account + qty precision |
| `57a3ea4` | Rev 46: Decrypt fix + copy signal + SSI basket |
| `3ae7de4` | Rev 45: Strategy differentiation + bot basket/methodology |

---

## Contributing

This is an actively developed project. All contributions should:

1. Pass TypeScript strict mode (`npx tsc --noEmit` — 0 errors in all 4 packages)
2. Use real API calls only — no mocks, no hardcoded sample data
3. Full file replacements only — no partial TODOs
4. Test against the live SoSoValue API and SoDEX Testnet before PR
5. Update `summary.md` with a new Rev section describing all changes

---

## License

Private — all rights reserved. Contact the SoSoMind team for licensing.

---

<div align="center">
Built with precision for the serious crypto trader.<br>
<a href="https://sosomind.vercel.app">Dashboard</a> · <a href="https://t.me/sosomind_bot">Telegram Bot</a> · <a href="ARCHITECTURE.md">Full Architecture</a>
</div>
