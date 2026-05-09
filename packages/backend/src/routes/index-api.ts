import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await cached('soso:indices', 60, () => sosovalue.getIndices());
  res.json({ data });
}));

router.get('/snapshot/:ticker', asyncHandler(async (req, res) => {
  const data = await cached(`soso:idx:snap:${req.params.ticker}`, 30, () => sosovalue.getIndexMarketSnapshot(req.params.ticker));
  res.json({ data });
}));

router.get('/:ticker/constituents', asyncHandler(async (req, res) => {
  const data = await cached(`soso:idx:cons:${req.params.ticker}`, 60, () => sosovalue.getIndexConstituents(req.params.ticker));
  res.json({ data });
}));

router.get('/:ticker/klines', validate(z.object({ limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const data = await cached(`soso:idx:klines:${req.params.ticker}:${limit}`, 60, () => sosovalue.getIndexKlines(req.params.ticker, { limit }));
  res.json({ data });
}));

export default router;
