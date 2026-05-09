import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await cached('soso:stocks:list', 120, () => sosovalue.getCryptoStockList());
  res.json({ data });
}));

router.get('/sectors', asyncHandler(async (_req, res) => {
  const data = await cached('soso:stocks:sectors', 60, () => sosovalue.getCryptoStockSectors());
  res.json({ data });
}));

router.get('/sector-index/:sector', asyncHandler(async (req, res) => {
  const data = await cached(`soso:stocks:sectoridx:${req.params.sector}`, 60, () => sosovalue.getCryptoSectorIndex(req.params.sector));
  res.json({ data });
}));

router.get('/:ticker', asyncHandler(async (req, res) => {
  const data = await cached(`soso:stocks:snap:${req.params.ticker}`, 30, () => sosovalue.getCryptoStockSnapshot(req.params.ticker));
  res.json({ data });
}));

router.get('/:ticker/market-cap', validate(z.object({ start_date: z.string().optional(), end_date: z.string().optional(), limit: z.coerce.number().default(60) })), asyncHandler(async (req, res) => {
  const extra = (req as any).validated;
  const data = await cached(`soso:stocks:mcap:${req.params.ticker}:${JSON.stringify(extra)}`, 60, () => sosovalue.getCryptoStockMarketCap(req.params.ticker, extra));
  res.json({ data });
}));

router.get('/:ticker/klines', validate(z.object({ limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const data = await cached(`soso:stocks:klines:${req.params.ticker}:${limit}`, 60, () => sosovalue.getCryptoStockKlines(req.params.ticker, { limit }));
  res.json({ data });
}));

export default router;
