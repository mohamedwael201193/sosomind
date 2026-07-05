import { Router, type Request } from 'express';
import { z } from 'zod';
import { sodex, getSodexClientFromRequest } from '../clients/sodex.js';
import { asyncHandler, validate, cached } from '../utils/http.js';
import { runExecutionAgent } from '../agents/execution.js';

const router = Router();

function envKey(req: Request, key: string) {
  const id = req.sosomindEnv?.id ?? 'default';
  return `${id}:${key}`;
}

function client(req: Request) {
  return getSodexClientFromRequest(req);
}

// Spot read
router.get('/spot/symbols', asyncHandler(async (req, res) => {
  const c = client(req);
  const data = await cached(envKey(req, 'sodex:spot:symbols'), 60, () => c.getSpotSymbols());
  res.json({ data });
}));
router.get('/spot/orderbook', validate(z.object({ market: z.string().min(1), depth: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { market, depth } = (req as any).validated;
  const c = client(req);
  const data = await cached(envKey(req, `sodex:ob:${market}:${depth}`), 5, () => c.getSpotOrderbook(market, depth));
  res.json({ data });
}));
router.get('/spot/trades', validate(z.object({ market: z.string().min(1), limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { market, limit } = (req as any).validated;
  const c = client(req);
  const data = await cached(envKey(req, `sodex:trades:${market}:${limit}`), 5, () => c.getSpotTrades(market, limit));
  res.json({ data });
}));
router.get('/spot/klines', validate(z.object({ market: z.string().min(1), interval: z.string().default('1h'), limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { market, interval, limit } = (req as any).validated;
  const c = client(req);
  const data = await cached(envKey(req, `sodex:klines:${market}:${interval}:${limit}`), 30, () => c.getSpotKlines(market, interval, limit));
  res.json({ data });
}));

// Perps read
router.get('/perps/symbols', asyncHandler(async (req, res) => {
  const c = client(req);
  const data = await cached(envKey(req, 'sodex:perps:symbols'), 60, () => c.getPerpsSymbols());
  res.json({ data });
}));
router.get('/perps/orderbook', validate(z.object({ market: z.string().min(1), depth: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { market, depth } = (req as any).validated;
  const c = client(req);
  const data = await cached(envKey(req, `sodex:p:ob:${market}:${depth}`), 5, () => c.getPerpsOrderbook(market, depth));
  res.json({ data });
}));
router.get('/perps/positions', asyncHandler(async (req, res) => {
  const accId = req.query.accountID ? Number(req.query.accountID) : undefined;
  const data = await client(req).getPerpsPositions(accId);
  res.json({ data });
}));
router.get('/perps/funding-rate', validate(z.object({ market: z.string().min(1) })), asyncHandler(async (req, res) => {
  const { market } = (req as any).validated;
  const c = client(req);
  const data = await cached(envKey(req, `sodex:p:fund:${market}`), 30, () => c.getPerpsFundingRate(market));
  res.json({ data });
}));

router.get('/spot/tickers', asyncHandler(async (req, res) => {
  const c = client(req);
  const data = await cached(envKey(req, 'sodex:spot:tickers'), 10, () => c.getSpotTickers());
  res.json({ data });
}));

router.get('/user/:address/balances', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const addr = address.toLowerCase();
  const c = client(req);
  const data = await cached(envKey(req, `sodex:bal:${addr}`), 8, () => c.getSpotBalancesForAddress(addr));
  res.json({ data });
}));

router.get('/user/:address/orders', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : undefined;
  const data = await client(req).getSpotOrdersForAddress(address.toLowerCase(), symbol);
  res.json({ data });
}));

router.get('/user/:address/orders/history', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const addr = address.toLowerCase();
  const c = client(req);
  const data = await cached(envKey(req, `sodex:oh:${addr}:${symbol ?? ''}:${limit}`), 15, () =>
    c.getSpotOrderHistoryForAddress(addr, symbol, limit)
  );
  res.json({ data });
}));

router.get('/user/:address/accountid', asyncHandler(async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: 'invalid_address' });
  const addr = address.toLowerCase();
  const c = client(req);
  const accountID = await cached(envKey(req, `sodex:aid:${addr}`), 120, () => c.getAccountIDForAddress(addr));
  res.json({ accountID });
}));

router.get('/account/balances', asyncHandler(async (req, res) => {
  const accId = req.query.accountID ? Number(req.query.accountID) : undefined;
  const data = await sodex.getAccountBalances(accId);
  res.json({ data, address: sodex.getAddress() });
}));

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
