import { Router } from 'express';
import { handleA2ARequest } from '../a2a/handler';
import { getLeaderboard } from '../social/leaderboard';
import { runStressTest, listPresetScenarios } from '../simulation/stress';
import { getMacroOutlook } from '../agents/macroOverlay';
import { generateVoiceBrief, briefingScript, hasVoice } from '../agents/voice';
import { asyncHandler } from '../utils/http';
import { getBinanceKlines } from '../clients/market';

const router = Router();

// ─── Agent-to-Agent ──────────────────────────────────────────────────────────
router.post('/a2a/request', asyncHandler(async (req, res) => {
  const out = await handleA2ARequest(req.body || {});
  res.status(out.status === 'success' ? 200 : 400).json(out);
}));

// ─── Social leaderboard ──────────────────────────────────────────────────────
router.get('/social/leaderboard', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number((req.query.limit as string) || 20)));
  const data = await getLeaderboard(limit);
  res.json({ data });
}));

// ─── Stress simulator ────────────────────────────────────────────────────────
router.get('/simulation/scenarios', (_req, res) => {
  res.json({ data: listPresetScenarios() });
});

router.post('/simulation/run', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const scenario = body.scenario || { name: 'custom', assetChanges: body.assetChanges || {} };
  if (!scenario.assetChanges || typeof scenario.assetChanges !== 'object') {
    return res.status(400).json({ error: 'assetChanges object required' });
  }
  const result = await runStressTest(scenario);
  res.json({ data: result });
}));

// ─── Macro outlook (agents/* alias) ──────────────────────────────────────────
router.get('/agents/macro', asyncHandler(async (_req, res) => {
  const outlook = await getMacroOutlook();
  res.json({ data: outlook });
}));

// ─── Real asset correlation (30-day Pearson from Binance klines) ──────────────
router.get('/market/correlation', asyncHandler(async (_req, res) => {
  function pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const xs = x.slice(0, n), ys = y.slice(0, n);
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0);
    const d1 = Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0));
    const d2 = Math.sqrt(ys.reduce((s, v) => s + (v - my) ** 2, 0));
    return d1 && d2 ? num / (d1 * d2) : 0;
  }
  const [btcK, ethK, solK] = await Promise.all([
    getBinanceKlines('BTC', '1d', 30).catch(() => null),
    getBinanceKlines('ETH', '1d', 30).catch(() => null),
    getBinanceKlines('SOL', '1d', 30).catch(() => null),
  ]);
  const c = (k: typeof btcK) => (k ?? []).map(kl => kl.close);
  const BTC_ETH = +pearson(c(btcK), c(ethK)).toFixed(2);
  const BTC_SOL = +pearson(c(btcK), c(solK)).toFixed(2);
  const ETH_SOL = +pearson(c(ethK), c(solK)).toFixed(2);
  res.json({ data: { BTC_ETH, BTC_SOL, ETH_SOL, period: '30d', updated_at: new Date().toISOString() } });
}));

// ─── Voice brief ─────────────────────────────────────────────────────────────
router.post('/voice/brief', asyncHandler(async (req, res) => {
  if (!hasVoice()) return res.status(503).json({ error: 'voice_disabled', message: 'ELEVENLABS_API_KEY not set' });
  const body = req.body || {};
  const text = body.text || briefingScript(body);
  const buf = await generateVoiceBrief(text);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', 'inline; filename="brief.mp3"');
  res.send(buf);
}));

export default router;
