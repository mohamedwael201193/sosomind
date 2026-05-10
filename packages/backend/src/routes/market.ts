import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { sodex } from '../clients/sodex';
import { getBinanceKlines, getBinanceTicker, getSpotPrice } from '../clients/market';
import { asyncHandler, validate } from '../utils/http';

const router = Router();

// Real-time price + 24h change (SoSoValue snapshot → Binance 24hr ticker fallback)
router.get('/price/:symbol', asyncHandler(async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  let price: number | null = null;
  let change24h = 0;
  let source = 'sosovalue';

  try {
    const snap: any = await sosovalue.getMarketSnapshot(symbol);
    price = Number(snap?.price ?? snap?.last_price ?? 0) || null;
    if (price && price > 0) {
      change24h = Number(snap?.price_change_percentage_24h ?? snap?.change_24h ?? 0);
    }
  } catch { /* fall through */ }

  if (price == null || !Number.isFinite(price) || price <= 0) {
    // Use full Binance 24hr ticker — includes price + priceChangePercent
    const ticker = await getBinanceTicker(symbol);
    if (ticker && ticker.price > 0) {
      price = ticker.price;
      change24h = ticker.priceChangePercent;
      source = 'binance';
    } else {
      price = await getSpotPrice(symbol);
      source = 'binance';
    }
  }

  if (price == null) return res.status(404).json({ error: 'price_unavailable', symbol });
  res.json({ symbol, price, change24h, source, ts: Date.now() });
}));

// Klines / candles for charting
router.get('/klines/:symbol',
  validate(z.object({ interval: z.string().default('1h'), limit: z.coerce.number().default(100) })),
  asyncHandler(async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const { interval, limit } = (req as any).validated;
    const klines = await getBinanceKlines(symbol, interval, limit);
    if (!klines) return res.status(404).json({ error: 'klines_unavailable', symbol });
    res.json({ symbol, interval, count: klines.length, data: klines });
  })
);

// Orderbook depth (SoDEX spot)
router.get('/orderbook/:market',
  validate(z.object({ depth: z.coerce.number().default(20) })),
  asyncHandler(async (req, res) => {
    const market = req.params.market;
    const { depth } = (req as any).validated;
    const ob = await sodex.getSpotOrderbook(market, depth);
    res.json({ market, depth, data: ob });
  })
);

export default router;
