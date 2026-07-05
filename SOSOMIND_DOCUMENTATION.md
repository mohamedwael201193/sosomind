# SoSoMind — Production Documentation

**Version:** Wave 3 (July 2026)  
**Status:** Production  
**Dashboard:** https://sosomind.vercel.app  
**Backend:** https://sosomind-backend.onrender.com  

SoSoMind is a real SoDEX Mainnet application with live trading, live market intelligence, and optional Testnet execution. This document reflects the **current implementation only**.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Vision](#2-vision)
3. [System Architecture](#3-system-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Telegram Bot Architecture](#6-telegram-bot-architecture)
7. [AI Agent Architecture](#7-ai-agent-architecture)
8. [SoSoValue Integration](#8-sosovalue-integration)
9. [SoDEX Integration](#9-sodex-integration)
10. [SSI Integration](#10-ssi-integration)
11. [Mainnet Architecture](#11-mainnet-architecture)
12. [Testnet Architecture](#12-testnet-architecture)
13. [Trading Flow](#13-trading-flow)
14. [Portfolio Flow](#14-portfolio-flow)
15. [Research Pipeline](#15-research-pipeline)
16. [Signal Generation Pipeline](#16-signal-generation-pipeline)
17. [Risk Engine](#17-risk-engine)
18. [Order Execution Flow](#18-order-execution-flow)
19. [Environment Profiles](#19-environment-profiles)
20. [REST API Reference](#20-rest-api-reference)
21. [WebSocket API](#21-websocket-api)
22. [Database Schema](#22-database-schema)
23. [Security](#23-security)
24. [Deployment](#24-deployment)
25. [Environment Variables](#25-environment-variables)
26. [Folder Structure](#26-folder-structure)
27. [User Journey](#27-user-journey)
28. [UI Flow](#28-ui-flow)
29. [Main Features](#29-main-features)
30. [Production Limitations](#30-production-limitations)
31. [Future Roadmap](#31-future-roadmap)

---

## 1. Product Overview

SoSoMind is an agentic trading platform that closes the loop between market intelligence and on-chain execution:

**Research → Signals → Risk → Trade → Portfolio → Track Record**

Every step uses live APIs from SoSoValue and SoDEX. There is no demo mode on production surfaces. When data is unavailable, the UI shows **Unavailable** rather than fabricated numbers.

### Production surfaces

| Surface | URL | Role |
|---------|-----|------|
| Dashboard | https://sosomind.vercel.app | Web terminal (Vite + React) |
| Backend API | https://sosomind-backend.onrender.com | Express + TypeScript |
| Telegram | https://t.me/SosoMindbot | Mobile interface + testnet execution |
| SoDEX Mainnet | https://sodex.com | Default execution environment |
| SoDEX Testnet | https://testnet.sodex.com | Optional via Settings |

---

## 2. Vision

Build the **trustworthy agentic trading loop**: every recommendation is evidence-backed, every trade passes a risk gate, every outcome is tracked publicly, and execution is non-custodial on SoDEX.

Core principles in code:

- **Evidence first** — signals carry citations, confidence explanations, and invalidation theses
- **Risk gated** — no order reaches SoDEX without preflight checks
- **Non-custodial dashboard** — EIP-712 signing in the user's wallet
- **Environment aware** — mainnet-limited by default, testnet opt-in
- **Transparent outcomes** — HIT / STOP / DRIFT ledger on `/track-record`

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                          │
│  Vercel Dashboard  │  Telegram Bot  │  MCP Clients (Cursor, Claude)    │
└─────────┬──────────────────┬──────────────────────┬─────────────────────┘
          │ HTTPS            │ grammY               │ stdio MCP
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Render Backend (port 10000, always-on)                      │
│  Express REST  │  WebSocket /ws  │  Agent Pipeline  │  Cron Jobs      │
└─────────┬──────────────────┬──────────────────────┬─────────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐
│ SoSoValue    │  │ SoDEX GW     │  │ Supabase PostgreSQL + Upstash    │
│ REST API     │  │ Mainnet/Test │  │ Redis cache (5 min TTL)            │
└──────────────┘  └──────────────┘  └──────────────────────────────────┘
```

### Background jobs (backend)

| Job | Interval | Purpose |
|-----|----------|---------|
| WebSocket price push | 15s | BTC/ETH/SOL snapshots |
| WebSocket orderbook | 10s | BTC_vUSDC orderbook |
| Research loop | 4h | Auto-research 8 assets |
| Outcome evaluator | 1h | HIT/STOP/DRIFT resolution |
| Anomaly scan | 4h | Telegram alerts |
| Heartbeat cron | 5m | Render cron health |

---

## 4. Frontend Architecture

**Stack:** Vite 6, React 19, react-router 7, TanStack Query, Framer Motion, Tailwind CSS 4, ethers.js v6, Reown AppKit (WalletConnect).

**Entry:** `packages/dashboard/src/main.tsx` → `App.tsx`

### Routing

| Route | Page | Status |
|-------|------|--------|
| `/` | Landing (marketing) | Production |
| `/dashboard` | Overview hub | Production |
| `/trade` | 4-step trading wizard | Production |
| `/portfolio` | Portfolio Terminal | Production |
| `/signals` | AI Signals feed | Production |
| `/research` | Research terminal | Production |
| `/sectors` | SSI Sectors | Production |
| `/agents` | Macro Regime | Production |
| `/track-record` | Outcome ledger | Production |
| `/perps` | Perps read-only | Production |
| `/account` | Account & Funding | Production |
| `/settings` | Environment switch | Production |
| `/docs` | In-app documentation | Production |
| `/status` | System health | Production |
| `/arbitrage`, `/whales`, `/persona`, etc. | Labs previews | Preview only |

### Key libraries

| Module | Path | Role |
|--------|------|------|
| API client | `src/lib/api.ts` | Axios + `X-SoSoMind-Environment` header |
| Environment | `src/lib/environment.ts` | testnet/mainnet selector |
| WebSocket | `src/lib/websocket.ts` | `wss://backend/ws` |
| Health | `src/lib/health.ts` | Status bar polling |
| SoDEX signing | `src/lib/sodex-client.ts` | EIP-712 relay |
| Wallet | `src/context/WalletContext.tsx` | Reown/MetaMask |

### Environment switching

Users toggle **Testnet** or **Mainnet** in Settings. Selection persists in `localStorage` (`sosomind_environment`) and is sent on every API request via `X-SoSoMind-Environment: testnet|mainnet`.

Backend resolves to concrete profiles (`mainnet-limited`, `testnet`, etc.) via `packages/backend/src/config/environment.ts`.

---

## 5. Backend Architecture

**Stack:** Express + TypeScript, Node 20, deployed on Render.com.

**Entry:** `packages/backend/src/index.ts` → `server.ts`

### Route mounts

| Prefix | Module | Purpose |
|--------|--------|---------|
| `/api/health` | health.ts | Live + full health |
| `/api/config` | config.ts | Environment profiles |
| `/api/agents` | agents.ts | Research, signals |
| `/api/sodex` | sodex.ts | SoDEX proxy |
| `/api/sodex/relay` | sodex-relay.ts | EIP-712 relay (JWT) |
| `/api/trading` | trading.ts | Controls, order timeline |
| `/api/risk` | risk.ts | Preflight, circuit breaker |
| `/api/portfolio` | portfolio.ts | Portfolio snapshots |
| `/api/sectors`, `/api/ssi` | sectors, ssi | SSI intelligence |
| `/api/auth` | auth.ts | SIWE-style JWT |
| `/api/currencies`, `/api/etf`, etc. | various | SoSoValue proxies |
| `/ws` | ws/server.ts | WebSocket channels |

### AI provider chain

Priority fallback in `clients/ai.ts`:

1. Cerebras  
2. SambaNova  
3. Together AI  
4. OpenRouter  
5. Groq  
6. Gemini  

429 daily limits trigger 6h cooldown. Responses cached in Redis 5 minutes.

---

## 6. Telegram Bot Architecture

**Framework:** grammY (`packages/backend/src/bot/bot.ts`)

**Bot:** [@SosoMindbot](https://t.me/SosoMindbot)

### Commands (production)

| Command | Function |
|---------|----------|
| `/start`, `/help`, `/menu` | Onboarding |
| `/research` | Full research pipeline |
| `/signal`, `/signals` | Signal feed |
| `/trade` | Testnet spot orders |
| `/portfolio` | Wallet balances |
| `/ssi` | Sector scores |
| `/macro` | Macro events |
| `/track_record` | Outcome ledger |
| `/wallet`, `/link` | Embedded wallet management |
| `/alert` | Price alerts |

### Wallet model

- Embedded EVM wallets created per Telegram user
- Private keys encrypted AES-256-GCM (`WALLET_ENCRYPT_KEY`)
- Stored in `telegram_wallets` table
- Decrypted in-memory only at signing time
- **Telegram execution:** enabled on testnet profile; mainnet relay uses dashboard wallet

---

## 7. AI Agent Architecture

### Agent pipeline

```
Orchestrator
    ├── Research Agent  → 13+ parallel data fetches + AI synthesis
    ├── Risk Agent      → 4-check preflight gate
    ├── Macro Overlay   → ETF + BTC + calendar → 0-100 score
    └── Execution Agent → Limit-IOC SoDEX orders
```

### Orchestrator tasks

| Task | Flow |
|------|------|
| `research` | Circuit breaker → Research → Risk (amount=0) → log |
| `execute` | Circuit breaker → Execution → log |

Background research loop runs every 4 hours on: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE.

### Circuit breaker (`agents/circuitBreaker.ts`)

| Trigger | Scope | Cooldown |
|---------|-------|----------|
| 3 consecutive losses | Global halt | 1 hour |
| 2 consecutive losses on asset | Single asset | 24 hours |
| >15% drawdown on asset | Single asset | 24 hours |
| Daily drawdown < -5% | Global halt | Manual reset |

State persisted in `agent_meta` table.

---

## 8. SoSoValue Integration

**Client:** `packages/backend/src/clients/sosovalue.ts`  
**API key:** `SOSO_API_KEY`  
**Base URL:** `https://openapi.sosovalue.com/openapi/v1`

### Coverage (35 API methods)

- Market snapshots, klines, currencies
- ETF list, history, market snapshot
- SSI indices, constituents, klines
- Macro events and history
- Fundraising projects
- Featured/hot/search news
- Crypto stocks, BTC treasuries
- Analysis charts, sector spotlight

### MCP server

`packages/mcp-sosovalue` exposes all endpoints as MCP tools for AI clients.

---

## 9. SoDEX Integration

**Client:** `packages/backend/src/clients/sodex.ts`

### Gateways

| Environment | Gateway URL | Chain ID |
|-------------|-------------|----------|
| Mainnet | `https://mainnet-gw.sodex.dev/api/v1` | 286623 |
| Testnet | `https://testnet-gw.sodex.dev/api/v1` | 138565 |

### Order rules (enforced in code)

- **Type:** LIMIT only (market orders rejected — MissingOraclePrice)
- **Time in force:** IOC
- **Slippage:** +0.5% BUY, -0.5% SELL from mid
- **Signing:** EIP-712 typed data with chain-specific domain

### MCP server

`packages/mcp-sodex` — 19 tools for spot/perps market data and order placement.

### Proof links

Spot CLOB orders settle on SoDEX appchain. Dashboard links to SoDEX Portfolio → Order History, not ValueChain explorer UUIDs. ValueChain explorer (`main-scan.valuechain.xyz`) only for real EVM transaction hashes.

---

## 10. SSI Integration

**Module:** `packages/backend/src/agents/sectorIntelligence.ts`

### 13 tracked sectors

DeFi, AI, Layer 1, Layer 2, RWA, NFT, GameFi, MAG7, Meme, PayFi, CeFi, SocialFi, DePIN

### Composite scoring

| Signal | Weight | Source |
|--------|--------|--------|
| S1 Fundraising velocity | 30% | 7-day raise activity |
| S2 Institutional momentum | 35% | SSI index 7-day ROI |
| S3 Sector trend | 35% | 30-day kline trend |

Verdicts: STRONG_BUY (≥75), BUY (≥55), NEUTRAL (≥35), SELL (<35)

### Basket trading

On testnet, sectors map to BTC/ETH proxy assets via `SECTOR_PROXY`. Dashboard `/trade` supports Follow SSI Basket strategy.

---

## 11. Mainnet Architecture

**Default profile:** `mainnet-limited` (chainId **286623**)

| Setting | Value |
|---------|-------|
| Writes allowed | Yes |
| Max notional | $100 USD (configurable via `TRADING_MAX_NOTIONAL_USD`) |
| Kill switch | `KILL_SWITCH_TRADING` env var |
| Allowlist | Optional `TRADING_ALLOWLIST` (empty = all wallets) |
| Telegram execution | Disabled on mainnet profile |
| SoDEX app | https://sodex.com |
| Explorer | https://main-scan.valuechain.xyz |

### Mainnet-limited safeguards

1. Risk preflight gate (4 checks)
2. Circuit breaker
3. $100 notional cap per order
4. Operator kill switch (instant halt, no redeploy)
5. EIP-712 signature verification on relay
6. Rate limit: 30 relay requests/min per wallet

---

## 12. Testnet Architecture

**Profile:** `testnet` (chainId **138565**)

| Setting | Value |
|---------|-------|
| Writes allowed | Yes |
| Max notional | Same cap as mainnet-limited |
| Faucet | Available |
| Telegram execution | Enabled |
| SoDEX app | https://testnet.sodex.com |
| Explorer | https://test-scan.valuechain.xyz |

Users switch via Settings → Trading Environment → Testnet. Header `X-SoSoMind-Environment: testnet` routes all SoDEX calls to testnet gateway.

---

## 13. Trading Flow

### Dashboard (non-custodial)

1. **Strategy** — Copy Signal, Follow SSI Basket, or Manual Order
2. **Risk Preflight** — Client-side checks (wallet, USDC balance, min notional, market status)
3. **Sign & Submit** — MetaMask EIP-712 sign → `POST /api/sodex/relay`
4. **Execution Proof** — Poll `GET /api/trading/orders/:auditId/timeline` for SoDEX order ID

### Relay path (`routes/sodex-relay.ts`)

1. JWT wallet auth (`requireWallet`)
2. Kill switch + writesAllowed + allowlist + notional cap
3. EIP-712 signature verification
4. Optional `runRiskAgent()` if side/qty/price provided
5. Insert `signed_orders` audit row
6. Forward to SoDEX REST API
7. Update status; record PnL for circuit breaker

### Telegram (custodial testnet)

1. User sends `/trade BUY BTC 100`
2. Bot decrypts embedded wallet
3. Price waterfall: orderbook → ticker → Binance
4. Risk preflight
5. Direct `SoDEXClient.placeSpotOrder()`

---

## 14. Portfolio Flow

**Page:** `/portfolio`

### Data sources (live)

- `GET /api/sodex/user/:address/balances`
- `GET /api/sodex/user/:address/orders`
- `GET /api/sodex/user/:address/orders/history`
- `GET /api/sodex/user/:address/trades`
- `GET /api/sodex/spot/tickers` (USD pricing)

### Features

- Spot balance allocation pie chart
- Open orders table
- Order history with fees
- Fills/trades table
- Link to official SoDEX Portfolio (`config.active.sodexAppUrl`)

### Limitations

- Aggregate spot PnL shows **Unavailable** (SoDEX API does not expose aggregate spot PnL)
- Perps PnL available on `/perps` (read-only)

---

## 15. Research Pipeline

**Trigger:** `/research` page Run Analysis, `POST /api/agents/research/:asset`, Telegram `/research`, background 4h loop

### Research Agent steps

1. Parallel fetch (Promise.allSettled, never throws on partial failure):
   - SoSoValue: snapshot, economics, klines, sectors, ETF, treasuries, stocks, news, fundraising, macro, indices
   - Market context: Binance, DefiLlama, CoinGecko, CryptoPanic
2. Redis cache (`research:signal:{ASSET}`, 5 min)
3. Multi-factor baseline score (momentum, range, cycle, ETF flow, volume)
4. AI synthesis via `chatComplete()` if providers configured
5. Persist to `signals` with citations and provenance

**Timeout:** Dashboard allows 120s for analysis API call.

---

## 16. Signal Generation Pipeline

### Signal payload (stored in Supabase)

```typescript
{
  id, asset, direction, confidence,
  entry, takeProfit, stopLoss,
  rationale, citations[], regime,
  confidence_explanation, invalidation_thesis,
  outcome: 'HIT' | 'STOP' | 'DRIFT' | 'PENDING',
  created_at, outcome_at
}
```

### Confidence bands

| Score | Label | Action |
|-------|-------|--------|
| 80-100 | Strong | Full size |
| 65-79 | Moderate | Half size |
| 50-64 | Weak | Observe |
| <50 | No signal | Not emitted |

### Outcome tracking

Hourly evaluator compares live price to TP/SL with 0.5% tolerance. Results on `/track-record` and `/api/signals/track-record`.

### Evidence-first UI

Signal cards show provider, timestamp, freshness, confidence explanation, sources, and invalidation thesis when present in DB.

---

## 17. Risk Engine

**Module:** `packages/backend/src/agents/risk.ts`

### Preflight checks

| Check | Threshold | On fail |
|-------|-----------|---------|
| Daily trade cap | 100 trades/asset/24h (configurable) | Block |
| Concentration | 30% max single-asset exposure | Block |
| ATR filter | ATR > 15% of price | Block |
| Drawdown | Daily portfolio PnL < -5% | Halt all |

### API endpoints

- `GET /api/risk/preflight?asset=&qty=&price=&side=&walletUsdc=`
- `GET /api/risk/status` — circuit breaker state
- `GET /api/trading/controls` — kill switch, allowlist, caps

---

## 18. Order Execution Flow

```
Signal/Manual intent
       │
       ▼
Risk preflight (4 checks + circuit breaker)
       │
       ▼
Build LIMIT-IOC order (slippage-adjusted price)
       │
       ▼
EIP-712 sign in MetaMask
       │
       ▼
POST /api/sodex/relay { signature, action, params }
       │
       ▼
SoDEX gateway (mainnet-gw or testnet-gw)
       │
       ▼
Audit: signed_orders + trades tables
       │
       ▼
WebSocket portfolio/alerts broadcast
       │
       ▼
Outcome evaluator (hourly)
```

---

## 19. Environment Profiles

Defined in `packages/backend/src/config/environment.ts`:

| Profile ID | Chain | Writes | Default |
|------------|-------|--------|---------|
| `local` | env-based | if not DRY_RUN | dev |
| `testnet` | 138565 | Yes | user opt-in |
| `mainnet-readonly` | 286623 | No | — |
| `mainnet-limited` | 286623 | Yes ($100 cap) | **production default** |
| `mainnet` | 286623 | Yes ($500 cap) | future |

**Selector API:** `GET /api/config/environment`

Response includes `active` profile, `trading` controls (kill switch, max notional), and `profiles` list.

---

## 20. REST API Reference

**Base URL:** `https://sosomind-backend.onrender.com`

**Headers:**
- `X-SoSoMind-Environment: testnet|mainnet` (dashboard sends automatically)
- `Authorization: Bearer <jwt>` (wallet-authenticated routes)

### Core endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health/live` | Fast liveness (Render probe) |
| GET | `/api/health` | Full cached health snapshot |
| GET | `/api/config/environment` | Active environment profile |
| POST | `/api/agents/research/:asset` | Run research pipeline |
| GET | `/api/agents/macro` | Macro regime outlook |
| GET | `/api/signals` | Recent signals |
| GET | `/api/signals/track-record` | HIT/STOP/DRIFT counts |
| GET | `/api/public/signals` | Public track record (landing) |
| GET | `/api/risk/preflight` | Trade preflight |
| GET | `/api/risk/status` | Circuit breaker |
| GET | `/api/trading/controls` | Kill switch, caps |
| POST | `/api/sodex/relay` | EIP-712 order relay (JWT) |
| GET | `/api/trading/orders/:id/timeline` | Order audit trail |
| GET | `/api/sodex/user/:address/balances` | Spot balances |
| GET | `/api/sectors/intel` | All SSI sector scores |

Full interactive reference: https://sosomind.vercel.app/docs

---

## 21. WebSocket API

**URL:** `wss://sosomind-backend.onrender.com/ws`  
**Path:** `/ws` on shared HTTP port (not a separate :10001 in production)

### Subscribe

```json
{ "subscribe": "prices" }
```

### Channels

| Channel | Payload | Frequency |
|---------|---------|-----------|
| `prices` | BTC/ETH/SOL snapshots | 15s |
| `orderbook` | BTC_vUSDC orderbook | 10s |
| `signals` | Recent signals | Realtime + 30s poll |
| `alerts` | Triggered alerts | 60s |
| `trades` | Recent fills | On fill |

Client: `packages/dashboard/src/lib/websocket.ts` — auto-reconnect up to 12 attempts.

---

## 22. Database Schema

**Provider:** Supabase PostgreSQL

### Core tables

| Table | Purpose |
|-------|---------|
| `signals` | AI signals + outcomes + citations |
| `trades` | SoDEX order ledger |
| `signed_orders` | EIP-712 relay audit trail |
| `agent_logs` | Per-agent execution audit |
| `agent_meta` | Circuit breaker state |
| `user_profiles` | Wallet + Telegram link |
| `telegram_wallets` | Encrypted embedded wallets |
| `alerts` | User price alerts |
| `content_posts` | Content pipeline |
| `paper_trades` | Paper trading (Labs) |
| `funding_signals` | Funding rate signals |

Migrations: `packages/backend/src/db/migrations/` and `packages/backend/supabase/migrations/`

---

## 23. Security

| Mechanism | Implementation |
|-----------|----------------|
| Wallet auth | SIWE-style nonce → JWT (7-day HS256) |
| Relay signing | EIP-712 typed data, signer must match JWT wallet |
| Wallet encryption | AES-256-GCM for Telegram wallets |
| Production guards | Strong JWT_SECRET + WALLET_ENCRYPT_KEY required |
| Rate limits | 120 req/min global, 30/min relay per wallet |
| Kill switch | `KILL_SWITCH_TRADING=true` halts all trading |
| CORS | `CORS_ALLOWED_ORIGINS` + `FRONTEND_URL` |
| Cron auth | `CRON_SECRET` for heartbeat endpoint |
| House trades | `ALLOW_HOUSE_TRADES` + admin key (disabled by default) |

---

## 24. Deployment

### Render (backend)

- **Service:** `sosomind-backend`
- **Plan:** Starter (always-on)
- **Region:** Oregon
- **Health check:** `/api/health/live`
- **Config:** `render.yaml` at repo root

### Vercel (frontend)

- **URL:** https://sosomind.vercel.app
- **Build:** `packages/dashboard` — `npm run build` → `dist/`
- **SPA rewrite:** all routes → `index.html`
- **Config:** `packages/dashboard/vercel.json`

### Cron

- **Service:** `sosomind-heartbeat` every 5 minutes

---

## 25. Environment Variables

### Backend (Render)

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
TRADING_ENABLED=true
TRADING_MAX_NOTIONAL_USD=100
KILL_SWITCH_TRADING=false
SODEX_PRIVATE_KEY=0x...
SODEX_ADDRESS=0x...
SODEX_ACCOUNT_ID=

# Database
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Cache
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Auth
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

# Cron
CRON_SECRET=...
```

### Frontend (Vercel)

```bash
VITE_API_URL=https://sosomind-backend.onrender.com
VITE_DEFAULT_ENVIRONMENT=mainnet
VITE_REOWN_PROJECT_ID=...
```

---

## 26. Folder Structure

```
sosomind/
├── packages/
│   ├── backend/           # Express API, agents, bot, WS
│   │   ├── src/
│   │   │   ├── agents/    # Research, risk, execution, macro, SSI
│   │   │   ├── bot/       # Telegram grammY bot
│   │   │   ├── clients/   # SoSoValue, SoDEX, AI, market
│   │   │   ├── config/    # Environment profiles
│   │   │   ├── routes/    # REST endpoints
│   │   │   ├── ws/        # WebSocket server
│   │   │   └── db/        # Supabase + migrations
│   │   └── supabase/
│   ├── dashboard/         # Vite React SPA
│   │   ├── src/
│   │   │   ├── app/       # Page routes
│   │   │   ├── components/
│   │   │   ├── lib/       # API, WS, health, signing
│   │   │   └── content/   # Landing copy
│   │   └── vercel.json
│   ├── mcp-sosovalue/     # MCP server (35 tools)
│   └── mcp-sodex/         # MCP server (19 tools)
├── render.yaml
├── SOSOMIND_DOCUMENTATION.md
└── summary.md
```

---

## 27. User Journey

### New user (web)

1. Visit https://sosomind.vercel.app (landing)
2. Connect MetaMask via Reown AppKit
3. Complete setup progress (wallet, funding, first signal view)
4. Explore Overview dashboard story: Portfolio → Risk → AI Recommendation → Macro → Opportunities
5. Run Research on `/research` → view signal on `/signals`
6. Trade via `/trade` 4-step wizard (mainnet-limited by default)
7. Monitor fills on `/portfolio`
8. Verify outcomes on `/track-record`

### New user (Telegram)

1. Open [@SosoMindbot](https://t.me/SosoMindbot)
2. `/start` creates embedded wallet
3. `/research BTC` runs full pipeline
4. `/trade BUY BTC 100` on testnet (switch dashboard to testnet for mainnet)

---

## 28. UI Flow

### Dashboard story hierarchy

1. Portfolio summary (real SoDEX balances or Unavailable)
2. Current risk / macro regime
3. AI recommendation strip
4. Product journey (Research → Signals → Trade → Portfolio loop)
5. Signal feed + sector heatmap
6. Macro regime panel + system status

### Trade wizard

Strategy → Preflight → Sign → Proof

### Settings

Environment toggle (Mainnet / Testnet), wallet profile, theme.

---

## 29. Main Features

### Production (live)

- AI Research with real citations
- Evidence-first signals with outcome tracking
- SoDEX Mainnet trading (limited, $100 cap)
- SoDEX Testnet (Settings opt-in)
- Portfolio Terminal (balances, orders, fills)
- SSI 13-sector intelligence
- Macro regime scoring
- Perps read-only terminal
- Telegram bot (research, signals, testnet trade)
- WebSocket live feeds
- MCP tool servers
- Public track record
- System status monitoring

### Labs (preview, banner shown)

Arbitrage, Whales, Persona, Playbook, Rebalance, Strategies, Leaderboard, Newsletter, Alerts

---

## 30. Production Limitations

| Limitation | Detail |
|------------|--------|
| Mainnet notional cap | $100 per order (mainnet-limited profile) |
| Perps execution | Read-only UI; no production perps orders |
| Aggregate spot PnL | Unavailable from SoDEX API |
| Telegram mainnet | Execution disabled on mainnet profile |
| House trading | Disabled unless `ALLOW_HOUSE_TRADES=true` |
| Labs features | Preview quality; may have limited data |
| AI providers | Requires configured API keys; falls back to baseline scoring |
| Circuit breaker on trade page | Monitoring display; full wiring via backend |

---

## 31. Future Roadmap

See `/roadmap` page and `GET /api/roadmap` for live roadmap data.

Planned direction:

- Raise mainnet notional cap as track record builds
- Signal marketplace on-chain subscriptions
- Perps execution when SoDEX docs confirm production readiness
- Multi-user auth with per-user portfolios
- Portfolio analytics and PnL charts
- Tax reporting export
- Webhook integrations (Discord, Slack)

---

*This document is the single source of truth for SoSoMind production behavior. Last updated: July 2026.*
