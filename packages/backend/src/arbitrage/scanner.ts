/**
 * Cross-Exchange Arbitrage Scanner (Part 3)
 * Compares SoDEX prices vs Binance for arbitrage opportunities.
 * SoDEX taker fee: 0.065%, Binance taker fee: 0.1%
 * Min profitable spread: ~0.3% after fees
 */

import axios from 'axios';
import { sodex } from '../clients/sodex';
import { cachedFetch } from '../clients/redis';

export interface ArbitrageOpportunity {
  asset: string;
  sodex_symbol: string;
  binance_symbol: string;
  sodex_bid: number;
  sodex_ask: number;
  binance_bid: number;
  binance_ask: number;
  spread_pct: number;
  direction: 'buy_sodex_sell_binance' | 'buy_binance_sell_sodex';
  est_profit_pct: number;  // after fees
  est_profit_usd: number;  // per $1000 trade
  confidence: 'high' | 'medium' | 'low';
  detected_at: string;
}

const SODEX_TAKER_FEE = 0.00065; // 0.065%
const BINANCE_TAKER_FEE = 0.001;  // 0.10%
const TOTAL_FEE = SODEX_TAKER_FEE + BINANCE_TAKER_FEE; // 0.165% round trip
const MIN_PROFIT_PCT = 0.003; // 0.3% minimum profitable spread

const BINANCE_BASE = 'https://api.binance.com';

interface BinanceBookTicker {
  symbol: string;
  bidPrice: string;
  askPrice: string;
}

async function getBinancePrices(symbols: string[]): Promise<Map<string, { bid: number; ask: number }>> {
  try {
    const cacheKey = 'binance:book_tickers';
    let tickers: BinanceBookTicker[] = await cachedFetch(
      cacheKey,
      async () => {
        const res = await axios.get<BinanceBookTicker[]>(`${BINANCE_BASE}/api/v3/bookTicker`, { timeout: 5000 });
        return res.data;
      },
      10 // 10 second cache
    );
    if (!Array.isArray(tickers)) tickers = [];
    const map = new Map<string, { bid: number; ask: number }>();
    for (const t of tickers) {
      if (symbols.includes(t.symbol)) {
        map.set(t.symbol, { bid: parseFloat(t.bidPrice), ask: parseFloat(t.askPrice) });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function scanArbitrage(): Promise<ArbitrageOpportunity[]> {
  const ASSETS = [
    { asset: 'BTC', sodex: 'vBTC_vUSDC', binance: 'BTCUSDT' },
    { asset: 'ETH', sodex: 'vETH_vUSDC', binance: 'ETHUSDT' },
    { asset: 'SOL', sodex: 'vSOL_vUSDC', binance: 'SOLUSDT' },
    { asset: 'BNB', sodex: 'vBNB_vUSDC', binance: 'BNBUSDT' },
    { asset: 'AVAX', sodex: 'vAVAX_vUSDC', binance: 'AVAXUSDT' },
  ];

  const binanceSymbols = ASSETS.map(a => a.binance);
  const [sodexTickers, binancePrices] = await Promise.all([
    sodex.getSpotTickers().catch(() => null),
    getBinancePrices(binanceSymbols),
  ]);

  const sodexTickerList: any[] = Array.isArray(sodexTickers) ? sodexTickers : (sodexTickers as any)?.data ?? [];
  const sodexMap = new Map<string, { bid: number; ask: number }>();
  for (const t of sodexTickerList) {
    const name: string = t.symbol ?? t.name ?? '';
    const bid = parseFloat(t.bidPrice ?? t.bid ?? t.bestBid ?? 0);
    const ask = parseFloat(t.askPrice ?? t.ask ?? t.bestAsk ?? 0);
    if (bid > 0 && ask > 0) sodexMap.set(name, { bid, ask });
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const { asset, sodex: sodexSym, binance: binanceSym } of ASSETS) {
    const sod = sodexMap.get(sodexSym);
    const bin = binancePrices.get(binanceSym);
    if (!sod || !bin) continue;

    // Direction 1: Buy Binance, Sell SoDEX (if SoDEX ask > Binance ask)
    const spreadBuyBin = (sod.bid - bin.ask) / bin.ask;
    // Direction 2: Buy SoDEX, Sell Binance (if Binance bid > SoDEX ask)
    const spreadBuySod = (bin.bid - sod.ask) / sod.ask;

    let opportunity: ArbitrageOpportunity | null = null;

    if (spreadBuyBin > 0) {
      const profitPct = spreadBuyBin - TOTAL_FEE;
      if (profitPct >= MIN_PROFIT_PCT) {
        opportunity = {
          asset,
          sodex_symbol: sodexSym,
          binance_symbol: binanceSym,
          sodex_bid: sod.bid,
          sodex_ask: sod.ask,
          binance_bid: bin.bid,
          binance_ask: bin.ask,
          spread_pct: parseFloat((spreadBuyBin * 100).toFixed(4)),
          direction: 'buy_binance_sell_sodex',
          est_profit_pct: parseFloat((profitPct * 100).toFixed(4)),
          est_profit_usd: parseFloat((1000 * profitPct).toFixed(2)),
          confidence: profitPct > 0.01 ? 'high' : profitPct > 0.005 ? 'medium' : 'low',
          detected_at: new Date().toISOString(),
        };
      }
    } else if (spreadBuySod > 0) {
      const profitPct = spreadBuySod - TOTAL_FEE;
      if (profitPct >= MIN_PROFIT_PCT) {
        opportunity = {
          asset,
          sodex_symbol: sodexSym,
          binance_symbol: binanceSym,
          sodex_bid: sod.bid,
          sodex_ask: sod.ask,
          binance_bid: bin.bid,
          binance_ask: bin.ask,
          spread_pct: parseFloat((spreadBuySod * 100).toFixed(4)),
          direction: 'buy_sodex_sell_binance',
          est_profit_pct: parseFloat((profitPct * 100).toFixed(4)),
          est_profit_usd: parseFloat((1000 * profitPct).toFixed(2)),
          confidence: profitPct > 0.01 ? 'high' : profitPct > 0.005 ? 'medium' : 'low',
          detected_at: new Date().toISOString(),
        };
      }
    }

    if (opportunity) opportunities.push(opportunity);
  }

  return opportunities.sort((a, b) => b.est_profit_pct - a.est_profit_pct);
}

export function formatArbAlert(opp: ArbitrageOpportunity): string {
  const confEmoji = { high: '🟢', medium: '🟡', low: '🔵' }[opp.confidence];
  const dir = opp.direction === 'buy_sodex_sell_binance'
    ? '🔵 Buy SoDEX → Sell Binance'
    : '🟠 Buy Binance → Sell SoDEX';
  return (
    `${confEmoji} <b>Arbitrage: ${opp.asset}</b> (${opp.confidence.toUpperCase()} confidence)\n` +
    `${dir}\n` +
    `📊 Spread: <b>${opp.spread_pct.toFixed(3)}%</b> | Net profit: <b>${opp.est_profit_pct.toFixed(3)}%</b>\n` +
    `💰 Est. profit per $1,000: <b>$${opp.est_profit_usd.toFixed(2)}</b>\n` +
    `SoDEX: Bid $${opp.sodex_bid.toLocaleString()} / Ask $${opp.sodex_ask.toLocaleString()}\n` +
    `Binance: Bid $${opp.binance_bid.toLocaleString()} / Ask $${opp.binance_ask.toLocaleString()}`
  );
}
