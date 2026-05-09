# SosoMind — Institutional Crypto Intelligence Platform

> AI-powered research, execution, and content generation for serious crypto traders.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

---

## Overview

SosoMind is a full-stack autonomous crypto intelligence platform that:
- **Researches** any asset using 13+ live data sources (SoSoValue, ETF flows, macro events, crypto stocks)
- **Executes** trades on SoDEX DEX with full risk gating, circuit breaker protection, and EIP-712 signing
- **Generates** institutional-quality market briefings and publishes to Telegram
- **Monitors** risk continuously with anomaly detection, drawdown limits, and circuit breakers
- **Exposes** a real-time WebSocket feed for prices, orderbook, signals, and alerts

---

## Architecture

```
packages/
├── backend/          Express API + agents + bot (port 10000)
│   ├── src/
│   │   ├── agents/   research, risk, circuitBreaker, execution, orchestrator, sectorRotation, macroOverlay
│   │   ├── bot/      Telegram bot (grammy)
│   │   ├── clients/  sosovalue, sodex, ai (multi-provider: OpenRouter→Groq→Gemini)
│   │   ├── content/  autonomous content pipeline
│   │   ├── cron/     heartbeat, anomaly scanner
│   │   ├── db/       supabase client + CRUD helpers
│   │   ├── routes/   REST API endpoints (14 route files)
│   │   └── ws/       WebSocket server (port 10001)
├── dashboard/        React dashboard (Vite)
├── mcp-sosovalue/    MCP server — 35 SoSoValue tools
├── mcp-sodex/        MCP server — 25 SoDEX tools
└── openclaw-skills/  5 OpenClaw skill packs
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (optional, for production)

### Development
```bash
# 1. Clone and install
git clone <repo>
cd sosomind
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your keys (see .env.example for descriptions)

# 3. Start backend (dev mode with hot reload)
cd packages/backend
npm run dev

# 4. Start dashboard
cd packages/dashboard
npm run dev
```

Backend: http://localhost:10000  
Dashboard: http://localhost:3000  
WebSocket: ws://localhost:10001

### Production (Docker)
```powershell
.\scripts\start-production.ps1
```

---

## API Reference

### Health
| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Full service health (backend, SoSoValue, SoDEX, AI, Supabase, Telegram) |

### Research & Signals
| Endpoint | Description |
|----------|-------------|
| `POST /api/agents/research` | Deep research. Body: `{ "asset": "BTC" }` |
| `GET /api/signals` | Recent signals from DB |
| `GET /api/agents/macro` | Macro regime (risk-on/off/neutral) |
| `GET /api/sectors` | Sector momentum rankings |
| `GET /api/sectors/:name` | Single sector detail |

### Trading
| Endpoint | Description |
|----------|-------------|
| `POST /api/trades` | Execute trade. Body: `{ symbol, side, amount, orderType, dryRun }` |
| `GET /api/trades` | Trade history |
| `GET /api/trades/:id` | Single trade |

### Market Data (via SoSoValue)
| Endpoint | Description |
|----------|-------------|
| `GET /api/currencies` | All listed cryptocurrencies |
| `GET /api/etf` | ETF list and flows |
| `GET /api/stocks` | Crypto stocks (COIN, MSTR, etc.) |
| `GET /api/fundraising` | Fundraising projects |
| `GET /api/macro` | Macro events |
| `GET /api/news` | News feeds |
| `GET /api/charts` | Analysis charts (fear-greed, etc.) |

### Content
| Endpoint | Description |
|----------|-------------|
| `POST /api/content/generate` | Generate AI market briefing |
| `POST /api/content/publish` | Publish to Telegram channel |
| `GET /api/content/posts` | Published content history |

### Stats & Audit
| Endpoint | Description |
|----------|-------------|
| `GET /api/stats/accuracy` | Signal accuracy (30d) |
| `GET /api/stats/performance` | Trade performance (30d) |
| `GET /api/audit/logs` | Agent activity logs with pagination |

---

## WebSocket (port 10001)

```javascript
const ws = new WebSocket('ws://localhost:10001');
ws.send(JSON.stringify({ subscribe: 'prices' }));
// channels: prices | orderbook | signals | alerts | trades
```

Message format:
```json
{ "channel": "prices", "ts": 1720000000000, "data": [...] }
```

---

## Telegram Bot

| Command | Description |
|---------|-------------|
| `/research BTC` | Deep asset research + signal |
| `/signal BTC` | Quick signal |
| `/trade BTC buy 0.01` | Execute trade with confirmation |
| `/portfolio` | Portfolio snapshot |
| `/briefing` | Daily market briefing |
| `/journal` | Last 10 signals |
| `/subscribe` | Subscribe to automated alerts |
| `/settings` | View/update preferences |
| `/alert BTC > 70000` | Set price alert |

---

## Risk Management

Multi-layer protection:
1. **Pre-trade risk check**: daily trade cap (10), concentration cap (30%), ATR volatility, daily drawdown (-5%)
2. **Circuit breaker**: 3 consecutive losses → 1h trading pause; asset drop >15% → 24h asset block
3. **Anomaly scanner**: runs every 4h, detects price anomalies, ETF flow spikes, macro event windows
4. **DRY_RUN mode**: all SoDEX writes simulated when `DRY_RUN=true`

---

## Agents

| Agent | Description |
|-------|-------------|
| `research` | Fetches 13+ data sources in parallel, runs AI synthesis, returns structured signal |
| `risk` | Pure-logic gatekeeper — APPROVED / ADJUSTED / REJECTED / HALT |
| `execution` | EIP-712 signed order placement on SoDEX |
| `circuitBreaker` | Tracks losses and asset drops, blocks trading automatically |
| `orchestrator` | Coordinates research + risk + execution pipeline with background loop |
| `sectorRotation` | Scores sectors by fundraising + price momentum + news |
| `macroOverlay` | Classifies market regime (risk-on/off/neutral) from ETF flows + macro events |

---

## MCP Servers

```bash
# SoSoValue MCP (35 tools)
cd packages/mcp-sosovalue && npm run build && node dist/index.js

# SoDEX MCP (25 tools)
cd packages/mcp-sodex && npm run build && node dist/index.js
```

---

## OpenClaw Skills

| Skill | Description |
|-------|-------------|
| `market-research` | Deep research + signal generation |
| `portfolio-briefing` | Daily portfolio narrative |
| `risk-monitor` | Continuous risk monitoring |
| `trade-execution` | Gated trade execution with confirmation |
| `content-studio` | Autonomous content generation + publishing |

---

## Environment Variables

See [`.env.example`](.env.example) for all variables with descriptions.

**Required:**
- `SOSO_API_KEY`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- At least one AI key: `OPENROUTER_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY`

**For live trading:**
- `SODEX_PRIVATE_KEY` + `SODEX_API_KEY_NAME`
- `DRY_RUN=false`

| `/research <asset>` | Full multi-source report |
| `/signal <asset>` | Quick price snapshot |
| `/trade LONG|SHORT <asset> <qty>` | Trade with inline confirmation |
| `/portfolio` | Open positions + recent trades |
| `/briefing` | Market briefing across all modules |
| `/publish <asset>` | Generate publishable research post |
| `/alert <asset> gt|lt <price>` | Set price alert |

## Deployment

- **Backend** -> Render (`render.yaml` includes web service + 5-minute cron heartbeat).
- **Dashboard** -> Vercel (`vercel.json`).
- **DB** -> Supabase. **Cache** -> Upstash Redis.

## License

MIT
