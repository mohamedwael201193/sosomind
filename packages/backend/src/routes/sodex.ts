import { Router } from 'express';
import { z } from 'zod';
import { sodex } from '../clients/sodex';
import { asyncHandler, validate, cached } from '../utils/http';
import { runExecutionAgent } from '../agents/execution';

const router = Router();

// Spot read
router.get('/spot/symbols', asyncHandler(async (_req, res) => {
  const data = await cached('sodex:spot:symbols', 60, () => sodex.getSpotSymbols());
  res.json({ data });
}));
router.get('/spot/orderbook', validate(z.object({ market: z.string().min(1), depth: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { market, depth } = (req as any).validated;
  const data = await cached(`sodex:ob:${market}:${depth}`, 5, () => sodex.getSpotOrderbook(market, depth));
  res.json({ data });
}));
router.get('/spot/trades', validate(z.object({ market: z.string().min(1), limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { market, limit } = (req as any).validated;
  const data = await cached(`sodex:trades:${market}:${limit}`, 5, () => sodex.getSpotTrades(market, limit));
  res.json({ data });
}));
router.get('/spot/klines', validate(z.object({ market: z.string().min(1), interval: z.string().default('1h'), limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { market, interval, limit } = (req as any).validated;
  const data = await cached(`sodex:klines:${market}:${interval}:${limit}`, 30, () => sodex.getSpotKlines(market, interval, limit));
  res.json({ data });
}));

// Perps read
router.get('/perps/symbols', asyncHandler(async (_req, res) => {
  const data = await cached('sodex:perps:symbols', 60, () => sodex.getPerpsSymbols());
  res.json({ data });
}));
router.get('/perps/orderbook', validate(z.object({ market: z.string().min(1), depth: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { market, depth } = (req as any).validated;
  const data = await cached(`sodex:p:ob:${market}:${depth}`, 5, () => sodex.getPerpsOrderbook(market, depth));
  res.json({ data });
}));
router.get('/perps/positions', asyncHandler(async (req, res) => {
  const accId = req.query.accountID ? Number(req.query.accountID) : undefined;
  const data = await sodex.getPerpsPositions(accId);
  res.json({ data });
}));
router.get('/perps/funding-rate', validate(z.object({ market: z.string().min(1) })), asyncHandler(async (req, res) => {
  const { market } = (req as any).validated;
  const data = await cached(`sodex:p:fund:${market}`, 30, () => sodex.getPerpsFundingRate(market));
  res.json({ data });
}));

// Account
router.get('/account/balances', asyncHandler(async (req, res) => {
  const accId = req.query.accountID ? Number(req.query.accountID) : undefined;
  const data = await sodex.getAccountBalances(accId);
  res.json({ data, address: sodex.getAddress() });
}));

// Write
router.post('/spot/order',
  validate(z.object({
    market: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    price: z.coerce.number().optional(),
    amount: z.coerce.number().positive(),
    orderType: z.enum(['limit', 'market']).optional(),
    dryRun: z.boolean().optional(),
  }), 'body'),
  asyncHandler(async (req, res) => {
    const { market, side, amount, price, orderType, dryRun } = (req as any).validated;
    const result = await runExecutionAgent({ market, side, amount, price, orderType, dryRun });
    res.json(result);
  })
);

router.post('/spot/cancel',
  validate(z.object({
    market: z.string().min(1),
    orderID: z.string().optional(),
    clOrdID: z.string().optional(),
  }), 'body'),
  asyncHandler(async (req, res) => {
    const { market, orderID, clOrdID } = (req as any).validated;
    const symbolID = await sodex.resolveSymbolID(market, 'spot');
    const accountID = sodex.getAccountID();
    if (!accountID) return res.status(400).json({ error: 'SODEX_ACCOUNT_ID not configured' });
    const data = await sodex.cancelSpotOrder({ accountID, symbolID, orderID, clOrdID });
    res.json({ data });
  })
);

export default router;
