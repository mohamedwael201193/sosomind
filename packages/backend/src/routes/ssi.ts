/**
 * /api/ssi — SoSoValue Indexes (SSI Protocol) integration.
 *
 * SSI Protocol: On-chain spot-index protocol that wraps multi-asset baskets
 * into a single ERC-20 token. Mint/burn via smart contracts. Institutional-
 * grade custody via Cobo/Ceffu. Monthly rebalancing via PMM.
 *
 * Live products (launched Dec 2024, per whitepaper + ssi.sosovalue.com):
 *   - MAG7.ssi  — Top 7 crypto market-cap (≥10% each, rest by mcap, monthly)
 *   - DEFI.ssi  — Top DeFi protocols by TVL & volume, market-cap weighted
 *   - MEME.ssi  — Top 10 meme tokens, market-cap weighted, monthly
 *   - USSI      — Hedged USD-linked index (stablecoin exposure)
 *
 * All products are tradeable on SoDEX Spot via Mirror Protocol (MPC+TEE bridge).
 * Staking APY paid from protocol fees. Audited: BlockSec, SlowMist, Zenith.
 *
 * Endpoints:
 *   GET  /api/ssi/products                      → all SSI tokens (dynamic from API)
 *   GET  /api/ssi/products/:ticker              → composite snapshot (price + constituents + 30d klines)
 *   GET  /api/ssi/products/:ticker/composition  → constituent breakdown w/ weights
 *   GET  /api/ssi/products/:ticker/klines       → klines passthrough
 *   GET  /api/ssi/protocol-stats                → protocol-level TVL, holders, APY
 *   POST /api/ssi/recommend                     → AI-ranked basket for persona
 *   GET  /api/ssi/portfolio/:wallet             → wallet's SSI holdings
 */
import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue.js';
import { supabase } from '../db/supabase.js';
import { chatComplete } from '../clients/ai.js';
import { asyncHandler, validate, cached } from '../utils/http.js';
import { wrapMeta } from '../utils/responseMeta.js';

const router = Router();

/**
 * Static metadata for the 4 live SSI products (whitepaper §5.2 + ssi.sosovalue.com).
 * Keyed by the exact ticker used in the SoSoValue API `/indices` endpoint.
 * Merged with live data from `getIndices()` — static fields are fallbacks only.
 */
const SSI_STATIC: Record<string, {
  sector: string;
  thesis: string;
  constituents_count: number;
  weighting: string;
  rebalance: string;
  custodian: string;
  sodex_tradeable: boolean;
}> = {
  'MAG7.ssi': {
    sector: 'Mega-Cap Blend',
    thesis: 'Top 7 crypto projects by market cap. Minimum 10% per token; remainder weighted by circulating market cap. Monthly rebalance.',
    constituents_count: 7,
    weighting: 'Min 10% + market-cap weighted',
    rebalance: 'Monthly',
    custodian: 'Cobo/Ceffu',
    sodex_tradeable: true,
  },
  'DEFI.ssi': {
    sector: 'DeFi',
    thesis: 'Top DeFi protocols ranked by TVL and on-chain volume. Market-cap weighted. Monthly rebalance.',
    constituents_count: 10,
    weighting: 'Market-cap weighted',
    rebalance: 'Monthly',
    custodian: 'Cobo/Ceffu',
    sodex_tradeable: true,
  },
  'MEME.ssi': {
    sector: 'Meme',
    thesis: 'Top 10 meme tokens by circulating market cap. Pure market-cap weighted. Monthly rebalance.',
    constituents_count: 10,
    weighting: 'Market-cap weighted',
    rebalance: 'Monthly',
    custodian: 'Cobo/Ceffu',
    sodex_tradeable: true,
  },
  'USSI': {
    sector: 'Hedged / Stable',
    thesis: 'USD-hedged basket. Provides broad crypto exposure with reduced drawdown risk. For capital preservation.',
    constituents_count: 5,
    weighting: 'Equal-weight + hedge overlay',
    rebalance: 'Monthly',
    custodian: 'Cobo/Ceffu',
    sodex_tradeable: false,
  },
};

// Fallback tickers if the API `getIndices()` returns empty
const FALLBACK_TICKERS = Object.keys(SSI_STATIC);

/** Normalize one SSI snapshot into a stable shape for the dashboard. */
function normalizeSnapshot(ticker: string, snap: any, indexMeta?: any): any {
  const staticMeta = SSI_STATIC[ticker] ?? { sector: 'Index Basket', thesis: 'On-chain SSI index basket.' };
  const price = Number(
    snap?.price ?? snap?.last_price ?? snap?.close ?? snap?.nav ?? snap?.current_price ?? 0,
  );
  const change24h = Number(
    snap?.price_change_percent_24h ?? snap?.change_pct_24h ?? snap?.change_24h ?? snap?.priceChangePct24h ?? 0,
  );
  // TVL: try multiple field names the API might return
  const tvl = Number(snap?.tvl ?? snap?.total_value_locked ?? snap?.market_cap ?? snap?.aum ?? indexMeta?.tvl ?? 0);
  const apy = Number(snap?.apy ?? snap?.staking_apy ?? snap?.yield_rate ?? snap?.yield ?? 0);
  const holders = Number(snap?.holders ?? snap?.holder_count ?? snap?.total_holders ?? 0);
  return {
    ticker,
    name: indexMeta?.name ?? snap?.name ?? ticker,
    sector: indexMeta?.sector ?? staticMeta.sector,
    thesis: staticMeta.thesis,
    custodian: staticMeta.custodian ?? 'Cobo/Ceffu',
    constituents_count: staticMeta.constituents_count ?? snap?.constituents_count ?? null,
    weighting: staticMeta.weighting ?? 'Market-cap weighted',
    rebalance: staticMeta.rebalance ?? 'Monthly',
    sodex_tradeable: staticMeta.sodex_tradeable ?? false,
    price,
    change24h,
    tvl,
    apy,
    holders,
    nav: snap?.nav ?? snap?.net_asset_value ?? null,
    // Pass raw through so UI can inspect any extra fields
    _raw: snap ?? {},
  };
}

/** Discover tickers: getIndices() first, fallback to FALLBACK_TICKERS if empty. */
async function discoverTickers(): Promise<string[]> {
  try {
    const indices = await sosovalue.getIndices();
    if (Array.isArray(indices) && indices.length > 0) {
      return indices.map((idx: any) => String(idx.ticker ?? idx.symbol ?? idx.index_ticker ?? '')).filter(Boolean);
    }
  } catch {}
  return FALLBACK_TICKERS;
}

router.get('/products', asyncHandler(async (_req, res) => {
  const cacheTtl = 60;
  const startedAt = Date.now();
  try {
    const products = await cached('ssi:products', cacheTtl, async () => {
      // Step 1: discover real tickers from the API
      const tickers = await discoverTickers();
      // Step 2: fetch all snapshots in parallel; failures resolve to null
      const settled = await Promise.allSettled(
        tickers.map((t) => sosovalue.getIndexMarketSnapshot(t)),
      );
      return tickers.map((t, i) => {
        const r = settled[i];
        const snap = r.status === 'fulfilled' ? r.value : null;
        const staticMeta = SSI_STATIC[t];
        return normalizeSnapshot(t, snap ?? {}, staticMeta);
      });
    });
    res.json(wrapMeta(products, { ttlMs: cacheTtl * 1000, source: 'live', cachedAt: startedAt }));
  } catch {
    // Always return static fallback — never let this endpoint return 500
    const fallback = FALLBACK_TICKERS.map((t) => normalizeSnapshot(t, {}, SSI_STATIC[t]));
    res.json(wrapMeta(fallback, { ttlMs: 0, source: 'fallback', cachedAt: startedAt }));
  }
}));

// Protocol-level aggregate stats (TVL, holders, APY)
router.get('/protocol-stats', asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  const stats = await cached('ssi:protocol-stats', 120, async () => {
    const tickers = await discoverTickers();
    const settled = await Promise.allSettled(tickers.map((t) => sosovalue.getIndexMarketSnapshot(t)));
    let totalTVL = 0, totalHolders = 0, maxAPY = 0;
    tickers.forEach((t, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled' && r.value) {
        const snap = r.value as any;
        totalTVL += Number(snap.tvl ?? snap.total_value_locked ?? snap.market_cap ?? 0);
        totalHolders += Number(snap.holders ?? snap.holder_count ?? 0);
        const apy = Number(snap.apy ?? snap.staking_apy ?? 0);
        if (apy > maxAPY) maxAPY = apy;
      }
    });
    return {
      protocol: 'SSI Protocol',
      description: 'On-chain spot-index protocol. Mint/burn via EVM smart contracts. Custodian: Cobo/Ceffu. Audited: BlockSec, SlowMist, Zenith.',
      total_tvl: totalTVL,
      total_holders: totalHolders,
      highest_apy: maxAPY,
      products_count: tickers.length,
      chain: 'EVM (Base Chain bridge via Mirror Protocol)',
      website: 'https://ssi.sosovalue.com',
    };
  });
  res.json(wrapMeta(stats, { ttlMs: 120_000, source: 'live', cachedAt: startedAt }));
}));

router.get('/products/:ticker', asyncHandler(async (req, res) => {
  const ticker = req.params.ticker;
  const cacheTtl = 30;
  const startedAt = Date.now();
  const composite = await cached(`ssi:product:${ticker}`, cacheTtl, async () => {
    const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [snap, cons, klines] = await Promise.all([
      safe(sosovalue.getIndexMarketSnapshot(ticker)),
      safe(sosovalue.getIndexConstituents(ticker)),
      safe(sosovalue.getIndexKlines(ticker, { limit: 30 })),
    ]);
    return {
      product: normalizeSnapshot(ticker, snap),
      constituents: Array.isArray(cons) ? cons : [],
      klines: Array.isArray(klines) ? klines : [],
    };
  });
  res.json(wrapMeta(composite, { ttlMs: cacheTtl * 1000, source: 'live', cachedAt: startedAt }));
}));

router.get('/products/:ticker/composition', asyncHandler(async (req, res) => {
  const ticker = req.params.ticker;
  const startedAt = Date.now();
  const cons = await cached(`ssi:cons:${ticker}`, 60, () => sosovalue.getIndexConstituents(ticker));
  const total = (cons as any[]).reduce((s, c: any) => s + Number(c.weight ?? c.weight_pct ?? c.allocation ?? 0), 0) || 1;
  const norm = (cons as any[]).map((c: any) => {
    const w = Number(c.weight ?? c.weight_pct ?? c.allocation ?? 0);
    return {
      symbol: c.symbol ?? c.token ?? c.name ?? '?',
      name:   c.name ?? c.symbol ?? '?',
      weight: w,
      weight_pct: total > 0 ? +(w / total * 100).toFixed(2) : 0,
      change24h: Number(c.price_change_percent_24h ?? c.change_24h ?? 0),
      price: Number(c.price ?? 0),
      raw: c,
    };
  }).sort((a, b) => b.weight - a.weight);
  res.json(wrapMeta(norm, { ttlMs: 60_000, source: 'live', cachedAt: startedAt }));
}));

router.get('/products/:ticker/klines',
  validate(z.object({ limit: z.coerce.number().default(30) })),
  asyncHandler(async (req, res) => {
    const { limit } = (req as any).validated;
    const ticker = req.params.ticker;
    const startedAt = Date.now();
    const data = await cached(`ssi:klines:${ticker}:${limit}`, 60,
      () => sosovalue.getIndexKlines(ticker, { limit }));
    res.json(wrapMeta(data, { ttlMs: 60_000, source: 'live', cachedAt: startedAt }));
  }),
);

const recommendSchema = z.object({
  persona: z.enum(['aggressive', 'balanced', 'conservative', 'quant', 'swing']).default('balanced'),
  horizon: z.enum(['short', 'medium', 'long']).default('medium'),
  riskAppetite: z.coerce.number().min(0).max(100).default(50),
});

router.post('/recommend', validate(recommendSchema, 'body'), asyncHandler(async (req, res) => {
  const { persona, horizon, riskAppetite } = (req as any).validated;
  const tickers = await discoverTickers();
  const settled = await Promise.allSettled(tickers.map((t) => sosovalue.getIndexMarketSnapshot(t)));
  const products = tickers.map((t, i) => {
    const r = settled[i];
    return normalizeSnapshot(t, r.status === 'fulfilled' ? r.value : {}, SSI_STATIC[t]);
  }).filter((p) => p.price > 0 || SSI_STATIC[p.ticker]) as any[];

  // Heuristic scoring — uses real ticker names from API now
  const ranked = products.map((p) => {
    let score = 50;
    score += p.change24h * 1.5;
    const t = p.ticker;
    if (persona === 'aggressive') {
      score += p.change24h * 2;
      if (t === 'MEME.ssi') score += 8;
    }
    if (persona === 'conservative') {
      score += (t === 'MAG7.ssi' ? 12 : 0) + (t === 'USSI' ? 15 : 0) - Math.abs(p.change24h);
    }
    if (persona === 'balanced') {
      score += (t === 'DEFI.ssi' ? 6 : 0) + (t === 'MAG7.ssi' ? 4 : 0);
    }
    if (persona === 'quant') {
      score += p.tvl > 0 ? Math.log10(p.tvl + 1) * 2 : 0;
    }
    if (persona === 'swing') score += Math.abs(p.change24h) * 2;
    if (horizon === 'long')  score += (t === 'MAG7.ssi' ? 6 : 0) + (t === 'DEFI.ssi' ? 4 : 0);
    if (horizon === 'short') score += Math.abs(p.change24h);
    score += (riskAppetite - 50) * 0.05 * p.change24h;
    return { ...p, score: Math.round(score) };
  }).sort((a, b) => b.score - a.score);

  const top3 = ranked.slice(0, 3);
  const aiResp = await chatComplete([
    { role: 'system', content: 'You are an institutional crypto index analyst. Output one paragraph (≤120 words) explaining why these SSI basket tokens were selected for the given investor profile. Reference real-world data: 24h momentum, TVL, sector thesis. Do NOT mention any competitor products.' },
    { role: 'user', content: `Persona: ${persona}. Horizon: ${horizon}. Risk appetite: ${riskAppetite}/100.\nTop SSI recommendations:\n${top3.map((p) => `- ${p.ticker} (${p.sector}, price ${p.price.toFixed(4)}, 24h ${p.change24h.toFixed(2)}%, TVL $${(p.tvl / 1e6).toFixed(1)}M)`).join('\n')}\nWrite the investment rationale.` },
  ], 0.5).catch(() => null);

  res.json(wrapMeta({
    persona, horizon, riskAppetite,
    ranked,
    rationale: aiResp?.content ?? 'Ranking based on 24h momentum, TVL depth, persona profile, and sector exposure.',
  }, { ttlMs: 60_000, source: 'computed' }));
}));

router.get('/portfolio/:wallet', asyncHandler(async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  // Pull positions whose symbol resembles an SSI token (ends in .ssi or starts with ssi).
  const { data: rows } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', wallet);
  const ssiHoldings = (rows ?? []).filter((r: any) => {
    const s = String(r.symbol ?? r.asset ?? '').toLowerCase();
    return s.endsWith('.ssi') || s.startsWith('ssi');
  });
  res.json(wrapMeta({ wallet, holdings: ssiHoldings }, { ttlMs: 30_000, source: 'live' }));
}));

export default router;
