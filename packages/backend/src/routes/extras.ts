import { Router } from 'express';
import { handleA2ARequest } from '../a2a/handler';
import { getLeaderboard } from '../social/leaderboard';
import { runStressTest, listPresetScenarios } from '../simulation/stress';
import { getMacroOutlook } from '../agents/macroOverlay';
import { generateVoiceBrief, briefingScript, hasVoice } from '../agents/voice';
import { asyncHandler, cached } from '../utils/http';
import { getBinanceKlines, getKrakenKlines } from '../clients/market';
import { supabase } from '../db/supabase';
import { chatComplete, ChatMessage } from '../clients/ai';
import { wrapMeta } from '../utils/responseMeta';

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
  const outlook = await cached('soso:macro:outlook', 90, () => getMacroOutlook());
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
  const klinesWithFallback = async (asset: string) => {
    const b = await getBinanceKlines(asset, '1d', 30).catch(() => null);
    if (b && b.length > 0) return b;
    return getKrakenKlines(asset, '1d', 30).catch(() => null);
  };
  const [btcK, ethK, solK] = await Promise.all([
    klinesWithFallback('BTC'),
    klinesWithFallback('ETH'),
    klinesWithFallback('SOL'),
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

// ─── Edge Analytics — wallet trade performance ────────────────────────────────
router.get('/edge/wallet/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;

  // Validate EVM address format (0x + 40 hex chars)
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: 'invalid_address', message: 'Address must be a valid 0x EVM address (42 chars)' });
  }

  // Step 1: Look up user_id linked to this wallet address in user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('wallet_address', address)
    .maybeSingle();

  // Step 2: Query trades by user_id OR confirmed_by (house wallet uses confirmed_by='system')
  let tradesQuery = supabase
    .from('trades')
    .select('market, side, price, amount, status, created_at')
    .eq('status', 'filled');

  if (profile?.id) {
    tradesQuery = tradesQuery.or(`user_id.eq.${profile.id},confirmed_by.ilike.%${address.toLowerCase()}%`);
  } else {
    tradesQuery = tradesQuery.ilike('confirmed_by', `%${address.toLowerCase()}%`);
  }

  const { data: trades } = await tradesQuery.limit(200);

  if (!trades || trades.length === 0) {
    return res.json(wrapMeta({ address, trades: 0, source: 'empty' }, { ttlMs: 60_000, source: 'live' }));
  }

  // Group by market → compute trade count per market
  const byMarket: Record<string, { count: number; buys: number; sells: number }> = {};
  for (const t of trades) {
    const m = String(t.market ?? 'unknown');
    if (!byMarket[m]) byMarket[m] = { count: 0, buys: 0, sells: 0 };
    byMarket[m].count++;
    if (t.side === 'buy') byMarket[m].buys++;
    else byMarket[m].sells++;
  }

  // Hour-of-day distribution for timing insight
  const byHour: number[] = Array(24).fill(0);
  for (const t of trades) {
    const hr = new Date(t.created_at ?? 0).getUTCHours();
    byHour[hr] = (byHour[hr] ?? 0) + 1;
  }
  const peakHour = byHour.indexOf(Math.max(...byHour));

  // AI summary
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a concise DeFi trade analyst. Respond ONLY with valid JSON: {"summary":"..."}',
    },
    {
      role: 'user',
      content: `Wallet ${address} has ${trades.length} filled trades across ${Object.keys(byMarket).length} markets. Most active hour UTC: ${peakHour}. Top markets: ${Object.keys(byMarket).slice(0, 3).join(', ')}. Write a 1-sentence performance edge summary.`,
    },
  ];

  let aiSummary = '';
  try {
    const resp = await chatComplete(messages, 0.3);
    if (resp) {
      const parsed = JSON.parse(resp.content);
      aiSummary = parsed.summary ?? '';
    }
  } catch { /* non-fatal */ }

  return res.json(wrapMeta(
    {
      address,
      total_trades: trades.length,
      markets: byMarket,
      peak_hour_utc: peakHour,
      ai_summary: aiSummary,
      source: 'live',
    },
    { ttlMs: 300_000, source: 'live' },
  ));
}));

export default router;
