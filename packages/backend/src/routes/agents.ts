import { Router } from 'express';
import { z } from 'zod';
import { runResearchAgent } from '../agents/research';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';
import { wrapMeta } from '../utils/responseMeta';
import { getBinanceTicker, getCoinGeckoPrices, getPriceFromAnyExchange } from '../clients/market';

const router = Router();

// Run research pipeline & persist signal
router.post('/research/:asset', asyncHandler(async (req, res) => {
  const asset = req.params.asset;
  const userId = (req.body?.userId as string | undefined) ?? undefined;
  const signal = await runResearchAgent(asset, { userId, saveToDb: true });
  res.json({ signal });
}));

// Seed signals for top assets — call once after deploy to populate the feed
// GET /api/agents/seed-signals?key=<SEED_SECRET>
router.get('/seed-signals', asyncHandler(async (req, res) => {
  const secret = process.env.SEED_SECRET ?? 'sosomind-seed-2026';
  if (req.query.key !== secret) return res.status(403).json({ error: 'forbidden' });

  const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'LINK', 'DOGE'];
  const results: any[] = [];
  for (const asset of ASSETS) {
    try {
      const signal = await runResearchAgent(asset, { saveToDb: true });
      results.push({ asset, direction: signal.direction, confidence: signal.confidence, ok: true });
    } catch (e) {
      results.push({ asset, ok: false, error: (e as Error).message });
    }
  }
  return res.json({ seeded: results.length, results });
}));

// ─── Signal Track Record (public) ────────────────────────────────────────────
router.get('/signals/track-record', asyncHandler(async (_req, res) => {
  // Try to fetch persisted stats from agent_meta first
  const { data: metaRow } = await supabase
    .from('agent_meta')
    .select('value, updated_at')
    .eq('key', 'track_record')
    .maybeSingle();

  // Also pull live aggregate counts for enrichment
  const { data: liveStats } = await supabase
    .from('signals')
    .select('direction, status, outcome')
    .limit(1000);

  const totalSignals = liveStats?.length ?? 0;
  const activeSignals = liveStats?.filter((s: any) => s.status === 'active').length ?? 0;

  if (metaRow?.value) {
    const stored = metaRow.value as Record<string, any>;
    return res.json(wrapMeta(
      { ...stored, total_signals: totalSignals, active_signals: activeSignals },
      { cachedAt: metaRow.updated_at, ttlMs: 3_600_000, source: 'cache' },
    ));
  }

  // No persisted stats yet — return live aggregate placeholder
  const longSignals = liveStats?.filter((s: any) => s.direction === 'long').length ?? 0;
  const shortSignals = liveStats?.filter((s: any) => s.direction === 'short').length ?? 0;

  return res.json(wrapMeta(
    {
      hit_rate: null,
      evaluated_count: 0,
      avg_return_pct: null,
      by_direction: {
        long: { hits: 0, stops: 0, total: longSignals },
        short: { hits: 0, stops: 0, total: shortSignals },
      },
      by_asset: {},
      last_updated: null,
      total_signals: totalSignals,
      active_signals: activeSignals,
    },
    { ttlMs: 3_600_000, source: 'live' },
  ));
}));

router.get('/signals', validate(z.object({ status: z.string().optional(), asset: z.string().optional(), limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { status, asset, limit } = (req as any).validated;
  let q = supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  if (asset) q = q.eq('asset', asset.toUpperCase());
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data });
}));

// Fast live signal — DB first, then Binance momentum fallback (< 3s, no AI required)
router.get('/signals/live/:asset', asyncHandler(async (req, res) => {
  const asset = req.params.asset.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const freshCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  // 1. Fresh active signal for this exact asset (< 6h old)
  const { data: assetSignals } = await supabase
    .from('signals')
    .select('*')
    .eq('asset', asset)
    .eq('status', 'active')
    .gte('created_at', freshCutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (assetSignals?.[0]) return res.json({ signal: assetSignals[0], source: 'db' });

  // 2. Any fresh active signal (cross-asset copy)
  const { data: anySignals } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'active')
    .gte('created_at', freshCutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (anySignals?.[0]) return res.json({ signal: anySignals[0], source: 'db' });

  // 3. Multi-exchange price waterfall: Binance → OKX → Bybit → KuCoin → Coinbase → MEXC → Gate.io → Kraken → CoinGecko
  const priceData = await getPriceFromAnyExchange(asset).catch(() => null);
  if (!priceData || priceData.price <= 0) {
    return res.status(503).json({ error: `Cannot fetch price for ${asset} from any exchange` });
  }
  const { price, change24h, vol24h, source: priceSource } = priceData;
  const direction: 'LONG' | 'SHORT' | 'NEUTRAL' =
    change24h > 2 ? 'LONG' : change24h < -2 ? 'SHORT' : 'NEUTRAL';
  const confidence = Math.round(Math.min(75, 40 + Math.abs(change24h) * 3));
  const trend = direction === 'LONG'
    ? 'Bullish momentum — buyers in control.'
    : direction === 'SHORT'
    ? 'Bearish momentum — sellers dominating.'
    : 'Sideways action — no clear directional edge.';

  const signal: Record<string, any> = {
    asset,
    symbol: asset,
    direction: direction.toLowerCase(),
    confidence,
    confidence_explanation: `${confidence >= 60 ? 'Moderate' : 'Low'} (${confidence}/100) — ${priceSource} 24h momentum.`,
    reasoning: `[${priceSource}] 24h momentum: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% ($${price.toLocaleString()}). ${trend}`,
    entry: +price.toFixed(4),
    take_profit: +(price * (direction === 'SHORT' ? 0.95 : 1.05)).toFixed(4),
    stop_loss: +(price * (direction === 'SHORT' ? 1.03 : 0.97)).toFixed(4),
    sources: [{ module: priceSource, insight: `24h Δ ${change24h.toFixed(2)}%${vol24h ? `, vol $${(vol24h / 1e6).toFixed(0)}M` : ''}` }],
    status: 'active',
  };

  // Persist to DB (non-blocking, best-effort)
  Promise.resolve(
    supabase.from('signals').insert({
      ...signal,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }).select('id').single()
  ).then(({ data }) => { if (data?.id) signal.id = data.id; })
   .catch(() => { /* non-fatal */ });

  return res.json({ signal, source: priceSource });
}));

router.get('/signals/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Validate UUID format to prevent routing collision with named sub-routes
  // (e.g. GET /signals/funding which is registered in the features router)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const { data, error } = await supabase.from('signals').select('*').eq('id', id).single();
  if (error) throw error;
  res.json({ data });
}));

router.delete('/signals/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('signals').update({ status: 'dismissed' }).eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/agent-logs', validate(z.object({ agent: z.string().optional(), limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { agent, limit } = (req as any).validated;
  let q = supabase.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (agent) q = q.eq('agent', agent);
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data });
}));

export default router;
