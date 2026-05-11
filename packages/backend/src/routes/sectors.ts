import { Router } from 'express';
import { getSectorMomentum } from '../agents/sectorRotation';
import { computeSectorScore, runAllSectorIntel } from '../agents/sectorIntelligence';
import { asyncHandler } from '../utils/http';
import { wrapMeta } from '../utils/responseMeta';
import { redis } from '../clients/redis';

const SSI_TICKERS = [
  'ssiDeFi','ssiAI','ssiLayer1','ssiLayer2','ssiRWA','ssiNFT','ssiMeme',
  'ssiGameFi','ssiMAG7','ssiPayFi','ssiCeFi','ssiSocialFi','ssiDePIN',
];

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const sectors = await getSectorMomentum();
  res.json({ data: sectors });
}));

// ─── Sector Intelligence endpoints ───────────────────────────────────────────

// GET /api/sectors/intel  →  intelligence scores for all 13 SSI sectors
// Add ?refresh=1 to bust the Redis cache and recompute immediately
router.get('/intel', asyncHandler(async (req, res) => {
  if (req.query.refresh === '1') {
    // Invalidate stale cached scores so the fixed algorithm runs fresh
    await Promise.allSettled(SSI_TICKERS.map((t) => redis.del(`intel:sector:${t}`)));
  }
  const results = await runAllSectorIntel();
  const sorted = [...results].sort((a, b) => b.score - a.score);
  res.json(wrapMeta(sorted, {
    ttlMs: 300_000,
    source: results.some((r) => r.source === 'fallback') ? 'fallback' : 'live',
  }));
}));

// GET /api/sectors/intel/:ticker  →  deep dive for a single SSI ticker
router.get('/intel/:ticker', asyncHandler(async (req, res) => {
  const ticker = req.params.ticker;
  try {
    const result = await computeSectorScore(ticker);
    res.json(wrapMeta(result, { ttlMs: 300_000, source: result.source }));
  } catch (e: any) {
    res.status(404).json({ error: e?.message ?? 'Ticker not found' });
  }
}));

// ─── Generic sector lookup (must come AFTER named /intel routes) ──────────────
router.get('/:sector', asyncHandler(async (req, res) => {
  const all = await getSectorMomentum();
  const match = all.find((s) => s.sector.toLowerCase() === req.params.sector.toLowerCase());
  if (!match) return res.status(404).json({ error: 'Sector not found' });
  res.json({ data: match });
}));

export default router;
