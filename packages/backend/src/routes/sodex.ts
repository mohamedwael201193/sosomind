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

// Spot tickers (all markets, 24h stats)
router.get('/spot/tickers', asyncHandler(async (_req, res) => {
  const data = await cached('sodex:spot:tickers', 10, () => sodex.getSpotTickers());
  res.json({ data });
}));

// Per-user balance & orders (by wallet address — public read endpoints on SoDEX)
router.get('/user/:address/balances', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const data = await cached(`sodex:bal:${address.toLowerCase()}`, 8, () =>
    sodex.getSpotBalancesForAddress(address.toLowerCase())
  );
  res.json({ data });
}));

router.get('/user/:address/orders', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : undefined;
  const data = await sodex.getSpotOrdersForAddress(address.toLowerCase(), symbol);
  res.json({ data });
}));

router.get('/user/:address/orders/history', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const data = await cached(`sodex:oh:${address.toLowerCase()}:${symbol ?? ''}:${limit}`, 15, () =>
    sodex.getSpotOrderHistoryForAddress(address.toLowerCase(), symbol, limit)
  );
  res.json({ data });
}));

// Resolve the numeric SoDEX accountID (aid) for a wallet address
router.get('/user/:address/accountid', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const accountID = await cached(`sodex:aid:${address.toLowerCase()}`, 120, () =>
    sodex.getAccountIDForAddress(address.toLowerCase())
  );
  res.json({ accountID });
}));

// House account balance (house wallet)
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
  }), 'body'),
  asyncHandler(async (req, res) => {
    const { market, side, amount, price, orderType } = (req as any).validated;
    const result = await runExecutionAgent({ market, side, amount, price, orderType });
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
