import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate } from '../utils/http';
import { runWhaleScan, getWhaleAlerts } from '../agents/whales';
import { scanArbitrage } from '../arbitrage/scanner';
import { runFundingRateScan, getFundingSignals } from '../agents/funding';
import { runConfluenceAnalysis } from '../agents/confluence';
import { getSentiment } from '../clients/sentiment';
import { calculateKellySizing } from '../utils/kelly';
import { checkMevRisk } from '../utils/mev';
import { parseTradeIntent } from '../bot/nlp';

const router = Router();

// ─── NLP Parse (Part 1) ────────────────────────────────────────────────────
router.post('/nlp/parse', asyncHandler(async (req, res) => {
  const text = String(req.body?.text ?? '');
  if (!text) return res.status(400).json({ error: 'text required' });
  const intent = parseTradeIntent(text);
  res.json({ text, intent });
}));

// ─── Whale Alerts (Part 4) ─────────────────────────────────────────────────
router.get('/whales', asyncHandler(async (_req, res) => {
  const alerts = await getWhaleAlerts(30);
  res.json({ data: alerts });
}));

router.post('/whales/scan', asyncHandler(async (_req, res) => {
  const alerts = await runWhaleScan();
  res.json({ data: alerts, count: alerts.length });
}));

// ─── Arbitrage Scanner (Part 3) ────────────────────────────────────────────
router.get('/arbitrage', asyncHandler(async (_req, res) => {
  const opportunities = await scanArbitrage();
  res.json({ data: opportunities, count: opportunities.length });
}));

// ─── Funding Rate Signals (Part 15) ───────────────────────────────────────
router.get('/signals/funding', asyncHandler(async (_req, res) => {
  const signals = await getFundingSignals(10);
  res.json({ data: signals });
}));

router.post('/signals/funding/scan', asyncHandler(async (_req, res) => {
  const signals = await runFundingRateScan();
  res.json({ data: signals, count: signals.length });
}));

// ─── Multi-Timeframe Confluence (Part 8) ──────────────────────────────────
router.get('/agents/confluence/:asset', asyncHandler(async (req, res) => {
  const asset = req.params.asset.toUpperCase().replace(/^V/, '');
  const result = await runConfluenceAnalysis(asset);
  res.json({ data: result });
}));

// ─── Social Sentiment (Part 11) ────────────────────────────────────────────
router.get('/sentiment/:asset', asyncHandler(async (req, res) => {
  const asset = req.params.asset.toUpperCase().replace(/^V/, '');
  const result = await getSentiment(asset);
  res.json({ data: result });
}));

// ─── Kelly Criterion (Part 10) ─────────────────────────────────────────────
router.post('/kelly/calculate',
  validate(z.object({
    win_rate: z.number().min(0).max(1),
    avg_win_pct: z.number(),
    avg_loss_pct: z.number(),
    portfolio_value: z.number(),
    confidence: z.number().optional(),
  })),
  asyncHandler(async (req, res) => {
    const { win_rate, avg_win_pct, avg_loss_pct, portfolio_value, confidence } = (req as any).validated;
    const result = calculateKellySizing({
      winRate: win_rate,
      avgWinPct: avg_win_pct / 100,
      avgLossPct: avg_loss_pct / 100,
      portfolioValue: portfolio_value,
      confidence,
    });
    res.json({ data: result });
  })
);

// ─── MEV Protection (Part 13) ──────────────────────────────────────────────
router.get('/mev/:symbol',
  validate(z.object({ side: z.enum(['buy', 'sell']).default('buy'), size_usd: z.coerce.number().default(1000) })),
  asyncHandler(async (req, res) => {
    const symbol = req.params.symbol;
    const { side, size_usd } = (req as any).validated;
    const result = await checkMevRisk(symbol, side, size_usd);
    res.json({ data: result });
  })
);

export default router;
