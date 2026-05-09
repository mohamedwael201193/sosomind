import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/list', validate(z.object({ symbol: z.string().default('BTC'), country_code: z.string().default('US') })), asyncHandler(async (req, res) => {
  const { symbol, country_code } = (req as any).validated;
  const data = await cached(`soso:etf:list:${symbol}:${country_code}`, 300, () => sosovalue.getETFList(symbol, country_code));
  res.json({ data });
}));

router.get('/snapshot/:ticker', asyncHandler(async (req, res) => {
  const data = await cached(`soso:etf:snap:${req.params.ticker}`, 30, () => sosovalue.getETFMarketSnapshot(req.params.ticker));
  res.json({ data });
}));

router.get('/summary', validate(z.object({ symbol: z.string().default('BTC'), country_code: z.string().default('US'), start_date: z.string().optional(), end_date: z.string().optional(), limit: z.coerce.number().default(30) })), asyncHandler(async (req, res) => {
  const { symbol, country_code, ...extra } = (req as any).validated;
  const data = await cached(`soso:etf:sum:${symbol}:${country_code}:${JSON.stringify(extra)}`, 60, () => sosovalue.getETFSummaryHistory(symbol, country_code, extra));
  res.json({ data });
}));

router.get('/history/:ticker', validate(z.object({ start_date: z.string().optional(), end_date: z.string().optional(), limit: z.coerce.number().default(90) })), asyncHandler(async (req, res) => {
  const extra = (req as any).validated;
  const data = await cached(`soso:etf:hist:${req.params.ticker}:${JSON.stringify(extra)}`, 60, () => sosovalue.getETFHistory(req.params.ticker, extra));
  res.json({ data });
}));

export default router;
