import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import currencies from './routes/currencies.js';
import etf from './routes/etf.js';
import indexApi from './routes/index-api.js';
import stocks from './routes/stocks.js';
import treasuries from './routes/treasuries.js';
import feeds from './routes/feeds.js';
import fundraising from './routes/fundraising.js';
import macro from './routes/macro.js';
import charts from './routes/charts.js';
import sodex from './routes/sodex.js';
import sodexRelay from './routes/sodex-relay.js';
import agents from './routes/agents.js';
import portfolio from './routes/portfolio.js';
import alerts from './routes/alerts.js';
import health from './routes/health.js';
import sectors from './routes/sectors.js';
import content from './routes/content.js';
import ssi from './routes/ssi.js';
import roadmap from './routes/roadmap.js';
import risk from './routes/risk.js';
import trades from './routes/trades.js';
import audit from './routes/audit.js';
import stats from './routes/stats.js';
import market from './routes/market.js';
import extras from './routes/extras.js';
import auth from './routes/auth.js';
import features from './routes/features.js';
import featureRoutes from './routes/featureRoutes.js';

import { createBot } from './bot/bot.js';
import { runHeartbeat } from './cron/heartbeat.js';
import { runAnomalyResearch } from './cron/anomaly.js';
import { startResearchLoop } from './agents/orchestrator.js';
import { startWebSocketServer } from './ws/server.js';
import { runDailyBriefing } from './content/pipeline.js';

export async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 10000);

  app.use(helmet());
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',').map(o => o.trim()).filter(Boolean);
  app.use(cors({
    origin: allowedOrigins.length ? (o, cb) => cb(null, !o || allowedOrigins.includes(o)) : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.use('/api/health', health);

  app.use('/api/currencies', currencies);
  app.use('/api/etf', etf);
  app.use('/api/indices', indexApi);
  app.use('/api/stocks', stocks);
  app.use('/api/treasuries', treasuries);
  app.use('/api/news', feeds);
  app.use('/api/fundraising', fundraising);
  app.use('/api/macro', macro);
  app.use('/api/analyses', charts);
  app.use('/api/sodex/relay', sodexRelay);
  app.use('/api/sodex', sodex);
  app.use('/api', agents);
  app.use('/api/portfolio', portfolio);
  app.use('/api/alerts', alerts);
  app.use('/api/sectors', sectors);
  app.use('/api/content', content);
  app.use('/api/ssi', ssi);
  app.use('/api/roadmap', roadmap);
  app.use('/api/risk', risk);
  app.use('/api/trades', trades);
  app.use('/api/audit', audit);
  app.use('/api/stats', stats);
  app.use('/api/market', market);
  app.use('/api', extras);
  app.use('/api/auth', auth);
  app.use('/api', features);
  app.use('/api', featureRoutes);

  // Prometheus-style metrics endpoint
  app.get('/metrics', (_req, res) => {
    const mem = process.memoryUsage();
    const lines = [
      '# HELP sosomind_uptime_seconds Process uptime in seconds',
      '# TYPE sosomind_uptime_seconds counter',
      `sosomind_uptime_seconds ${Math.round(process.uptime())}`,
      '# HELP sosomind_memory_heap_used_bytes Heap used bytes',
      '# TYPE sosomind_memory_heap_used_bytes gauge',
      `sosomind_memory_heap_used_bytes ${mem.heapUsed}`,
      '# HELP sosomind_memory_heap_total_bytes Heap total bytes',
      '# TYPE sosomind_memory_heap_total_bytes gauge',
      `sosomind_memory_heap_total_bytes ${mem.heapTotal}`,
      '# HELP sosomind_memory_rss_bytes Resident set size bytes',
      '# TYPE sosomind_memory_rss_bytes gauge',
      `sosomind_memory_rss_bytes ${mem.rss}`,
    ];
    res.set('Content-Type', 'text/plain; version=0.0.4').send(lines.join('\n') + '\n');
  });

  app.post('/api/cron/heartbeat', async (req, res) => {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
    const result = await runHeartbeat();
    res.json(result);
  });

  app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('unhandled', err);
    res.status(err.status || 500).json({ error: err.message || 'internal_error' });
  });

  app.listen(PORT, () => {
    console.log(`🧠 SosoMind backend listening on http://localhost:${PORT}`);
  });

  const bot = createBot();
  if (bot) {
    (globalThis as any).__sosomind_bot = bot;
    bot.start({ onStart: (info) => console.log(`🤖 Telegram bot @${info.username} online`) }).catch((e) => {
      console.error('bot.start failed', e);
    });
  }

  const HEARTBEAT_MS = 5 * 60 * 1000;
  setInterval(() => {
    runHeartbeat().catch((e) => console.error('heartbeat error', e));
  }, HEARTBEAT_MS);

  // Anomaly scan every 4 hours
  setInterval(() => {
    runAnomalyResearch().catch((e) => console.error('anomaly scan error', e));
  }, 4 * 60 * 60 * 1000);

  // Start auto-research loop (BTC/ETH/SOL every 4h)
  startResearchLoop();

  // Auto-publish Smart-Money brief every 15 minutes (newsletter feed). Bot may be optional.
  const BRIEFING_MS = 15 * 60 * 1000;
  setInterval(() => {
    const b = (globalThis as any).__sosomind_bot;
    if (b) runDailyBriefing(b).catch((e) => console.error('briefing tick error', e));
  }, BRIEFING_MS);

  // Start WebSocket server
  startWebSocketServer();
}
