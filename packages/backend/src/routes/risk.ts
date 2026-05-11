/**
 * /api/risk — pre-flight checks for the trade wizard.
 *
 * Aggregates circuit-breaker state, asset blocklist, slippage estimate
 * vs current orderbook, and naive exposure %.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  isGlobalCircuitOpen,
  isAssetBlocked,
  getCircuitStatus,
} from '../agents/circuitBreaker';
import { sodex } from '../clients/sodex';
import { asyncHandler, validate } from '../utils/http';
import { wrapMeta } from '../utils/responseMeta';

const router = Router();

router.get('/status', asyncHandler(async (_req, res) => {
  res.json(wrapMeta(getCircuitStatus(), { ttlMs: 5_000, source: 'live' }));
}));

const preflightSchema = z.object({
  asset: z.string().min(1),
  qty: z.coerce.number().positive(),
  price: z.coerce.number().positive().optional(),
  side: z.enum(['buy', 'sell']),
  market: z.string().optional(),
  walletUsdc: z.coerce.number().nonnegative().optional(),
});

router.get('/preflight',
  validate(preflightSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { asset, qty, price, side, market, walletUsdc } = (req as any).validated;
    const checks: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }> = [];

    // 1. Global circuit
    const globalOpen = isGlobalCircuitOpen();
    checks.push({
      id: 'circuit_global',
      label: 'Global circuit breaker',
      status: globalOpen ? 'fail' : 'pass',
      detail: globalOpen
        ? 'Trading paused after 3 consecutive losses. Try again later.'
        : 'Healthy. No global pause active.',
    });

    // 2. Per-asset block
    const assetBlocked = isAssetBlocked(asset);
    checks.push({
      id: 'asset_block',
      label: `${asset} asset block`,
      status: assetBlocked ? 'fail' : 'pass',
      detail: assetBlocked
        ? `${asset} blocked due to >15% 24h drop. 24h cool-down.`
        : `${asset} clear. No active block.`,
    });

    // 3. Slippage vs orderbook (best-effort — skip if no market)
    let slippagePct: number | null = null;
    let bestPx: number | null = null;
    if (market) {
      try {
        const ob: any = await sodex.getSpotOrderbook(market, 12);
        const levels = side === 'buy' ? ob?.asks : ob?.bids;
        if (Array.isArray(levels) && levels.length) {
          const best = Number(Array.isArray(levels[0]) ? levels[0][0] : levels[0]?.price);
          bestPx = best;
          if (price && best > 0) slippagePct = Math.abs((price - best) / best) * 100;
        }
      } catch { /* ignore */ }
    }
    checks.push({
      id: 'slippage',
      label: 'Slippage estimate',
      status: slippagePct == null ? 'warn' : slippagePct > 1.5 ? 'warn' : 'pass',
      detail: slippagePct == null
        ? 'Orderbook unavailable — could not estimate slippage.'
        : `${slippagePct.toFixed(2)}% vs best ${side === 'buy' ? 'ask' : 'bid'} (${bestPx ?? '?'}).`,
    });

    // 4. Notional-vs-balance exposure (warn at >25%, fail at >100%)
    const px = price ?? bestPx ?? 0;
    const notional = qty * px;
    let exposureCheck: 'pass' | 'warn' | 'fail' = 'pass';
    let exposureDetail = `Notional ~$${notional.toFixed(2)} USDC.`;
    if (walletUsdc != null && side === 'buy') {
      const pct = walletUsdc > 0 ? (notional / walletUsdc) * 100 : 100;
      exposureDetail = `Uses ${pct.toFixed(1)}% of available USDC ($${walletUsdc.toFixed(2)}).`;
      if (pct > 100) exposureCheck = 'fail';
      else if (pct > 25) exposureCheck = 'warn';
    }
    checks.push({
      id: 'exposure',
      label: 'Position concentration',
      status: exposureCheck,
      detail: exposureDetail,
    });

    const overall =
      checks.some((c) => c.status === 'fail') ? 'fail'
      : checks.some((c) => c.status === 'warn') ? 'warn'
      : 'pass';

    res.json(wrapMeta({
      overall,
      canProceed: overall !== 'fail',
      checks,
      asset, qty, price: price ?? null, side, market: market ?? null,
    }, { ttlMs: 5_000, source: 'computed' }));
  }),
);

export default router;
