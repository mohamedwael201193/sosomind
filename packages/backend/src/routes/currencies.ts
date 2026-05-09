import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await cached('soso:currencies', 60, () => sosovalue.getCurrencies());
  res.json({ data });
}));

router.get('/snapshot', validate(z.object({ symbol: z.string().min(1) })), asyncHandler(async (req, res) => {
  const { symbol } = (req as any).validated as { symbol: string };
  const data = await cached(`soso:snapshot:${symbol}`, 30, () => sosovalue.getMarketSnapshot(symbol));
  res.json({ data });
}));

router.get('/sector-spotlight', asyncHandler(async (_req, res) => {
  const data = await cached('soso:sectors', 60, () => sosovalue.getSectorSpotlight());
  res.json({ data });
}));

router.get('/pairs', validate(z.object({ symbol: z.string().min(1), page: z.coerce.number().default(1), page_size: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { symbol, page, page_size } = (req as any).validated as { symbol: string; page: number; page_size: number };
  const data = await cached(`soso:pairs:${symbol}:${page}:${page_size}`, 60, () => sosovalue.getPairs(symbol, page, page_size));
  res.json({ data });
}));

router.get('/:symbol/fundraising', asyncHandler(async (req, res) => {
  const data = await cached(`soso:fund:cur:${req.params.symbol}`, 120, () => sosovalue.getCurrencyFundraising(req.params.symbol));
  res.json({ data });
}));

router.get('/:symbol', validate(z.object({ symbol: z.string().min(1) }), 'params'), asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const data = await cached(`soso:currency:${symbol}`, 60, () => sosovalue.getCurrencyInfo(symbol));
  res.json({ data });
}));

router.get('/:symbol/economics', asyncHandler(async (req, res) => {
  const data = await cached(`soso:economics:${req.params.symbol}`, 120, () => sosovalue.getTokenEconomics(req.params.symbol));
  res.json({ data });
}));

router.get('/:symbol/klines', validate(z.object({ limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const data = await cached(`soso:klines:${req.params.symbol}:${limit}`, 30, () => sosovalue.getKlines(req.params.symbol, { limit }));
  res.json({ data });
}));

router.get('/:symbol/supply', asyncHandler(async (req, res) => {
  const data = await cached(`soso:supply:${req.params.symbol}`, 120, () => sosovalue.getSupply(req.params.symbol));
  res.json({ data });
}));

export default router;
