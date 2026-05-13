/**
 * Free Market Data Aggregator
 * Sources (no API key required unless noted):
 *  - Binance: price, 24hr stats, klines, orderbook — NO KEY needed
 *  - DefiLlama: TVL, protocols, chains, yields — NO KEY needed
 *  - CoinGecko: global stats, trending, prices — optional COINGECKO_API_KEY (demo tier)
 *  - CryptoPanic: curated news feed — optional CRYPTOPANIC_API_KEY (free dev tier)
 *
 * All data sources are best-effort. Errors are silently swallowed and null returned.
 * Use cachedFetch for data that changes slowly (TVL, global stats, etc.)
 */
import axios from 'axios';
import { cachedFetch } from './redis';

// ─── Binance config ──────────────────────────────────────────────────────────
const BINANCE_BASE = 'https://api.binance.com';
const binanceHttp = axios.create({ baseURL: BINANCE_BASE, timeout: 8000 });

// Map SosoMind/SoSoValue asset names → Binance symbol
// Covers all 32 SoDEX testnet spot pairs + common extras.
// Stocks (TSLA, NVDA, etc.), indices (MAG7ssi), and niche tokens (HYPE, SOSO)
// are NOT on Binance — those fall back to SoDEX ticker or SosoValue.
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  AVAX: 'AVAXUSDT', LINK: 'LINKUSDT', DOGE: 'DOGEUSDT', ARB: 'ARBUSDT',
  OP: 'OPUSDT', SUI: 'SUIUSDT', MATIC: 'MATICUSDT', DOT: 'DOTUSDT',
  ADA: 'ADAUSDT', XRP: 'XRPUSDT', LTC: 'LTCUSDT', ATOM: 'ATOMUSDT',
  UNI: 'UNIUSDT', AAVE: 'AAVEUSDT', INJ: 'INJUSDT', TIA: 'TIAUSDT',
  JUP: 'JUPUSDT', WIF: 'WIFUSDT', PEPE: 'PEPEUSDT', SHIB: 'SHIBUSDT',
  // SoDEX testnet extras
  ZEC: 'ZECUSDT', XAUT: 'XAUTUSDT', USDT: 'USDTUSDC',
  // HYPE, SOSO, TSLA, NVDA, META, AAPL, AMZN, GOOGL, MSFT, MAG7ssi, MEMEssi, DEFIssi, USSI
  // — not on Binance; handled by SoDEX ticker / SosoValue fallback
};

function toBinanceSymbol(asset: string): string {
  // Strip SoDEX "v" prefix and any existing quote suffix (USDT/BUSD/USDC/USD)
  // so that "BTCUSDT" → "BTC" → "BTCUSDT" (not "BTCUSDTUSDT")
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  return BINANCE_SYMBOL_MAP[a] || `${a}USDT`;
}

// ─── CoinGecko coin ID map ────────────────────────────────────────────────────
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', DOGE: 'dogecoin', ARB: 'arbitrum',
  OP: 'optimism', SUI: 'sui', MATIC: 'matic-network', DOT: 'polkadot',
  ADA: 'cardano', XRP: 'ripple', LTC: 'litecoin', ATOM: 'cosmos',
  UNI: 'uniswap', AAVE: 'aave', INJ: 'injective-protocol', TIA: 'celestia',
};

function toCoinGeckoId(asset: string): string {
  const a = asset.toUpperCase().replace(/^V/, '');
  return COINGECKO_ID_MAP[a] || a.toLowerCase();
}

// ─── DefiLlama config ────────────────────────────────────────────────────────
const LLAMA_BASE = 'https://api.llama.fi';
const llamaHttp = axios.create({ baseURL: LLAMA_BASE, timeout: 10000 });

// ─── CoinGecko config ────────────────────────────────────────────────────────
const GECKO_BASE = 'https://api.coingecko.com/api/v3';
const geckoHttp = axios.create({ baseURL: GECKO_BASE, timeout: 8000 });

// ─── CryptoPanic config ───────────────────────────────────────────────────────
const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/developer/v2';
const panicHttp = axios.create({ baseURL: CRYPTOPANIC_BASE, timeout: 8000 });

// ─── safe wrapper ────────────────────────────────────────────────────────────
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

// ============================================================================
// BINANCE — free, no API key
// ============================================================================

export interface BinanceTicker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  bidPrice: number;
  askPrice: number;
  count: number;
}

/**
 * GET /api/v3/ticker/24hr — rolling 24h stats + last price for one asset.
 * Returns null on error (no API key needed).
 */
export async function getBinanceTicker(asset: string): Promise<BinanceTicker | null> {
  const sym = toBinanceSymbol(asset);
  return cachedFetch(`binance:ticker:${sym}`, async () => {
    const r = await binanceHttp.get('/api/v3/ticker/24hr', { params: { symbol: sym } });
    const d = r.data;
    return {
      symbol: d.symbol,
      price: Number(d.lastPrice),
      priceChange: Number(d.priceChange),
      priceChangePercent: Number(d.priceChangePercent),
      highPrice: Number(d.highPrice),
      lowPrice: Number(d.lowPrice),
      volume: Number(d.volume),
      quoteVolume: Number(d.quoteVolume),
      bidPrice: Number(d.bidPrice),
      askPrice: Number(d.askPrice),
      count: Number(d.count),
    } as BinanceTicker;
  }, 15); // 15s cache
}

export interface BinanceKline {
  openTime: number;
  open: number; high: number; low: number; close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

/**
 * GET /api/v3/klines — OHLCV candlesticks.
 * interval: '1m'|'5m'|'15m'|'1h'|'4h'|'1d'|'1w'
 */
export async function getBinanceKlines(asset: string, interval = '1h', limit = 24): Promise<BinanceKline[] | null> {
  const sym = toBinanceSymbol(asset);
  return safe(cachedFetch(`binance:klines:${sym}:${interval}:${limit}`, async () => {
    const r = await binanceHttp.get('/api/v3/klines', { params: { symbol: sym, interval, limit } });
    if (r.status === 451 || r.status >= 400) throw new Error(`Binance blocked: ${r.status}`);
    return (r.data as any[]).map((k: any[]) => ({
      openTime: k[0], open: Number(k[1]), high: Number(k[2]),
      low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]),
      closeTime: k[6], quoteVolume: Number(k[7]), trades: Number(k[8]),
    }));
  }, 60)); // 60s cache
}

// ─── Kraken config — geo-unrestricted fallback for klines ────────────────────
const KRAKEN_BASE = 'https://api.kraken.com';
const krakenHttp = axios.create({ baseURL: KRAKEN_BASE, timeout: 10000 });

const KRAKEN_PAIR_MAP: Record<string, string> = {
  BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', AVAX: 'AVAXUSD',
  ARB: 'ARBUSD', OP: 'OPUSD', SUI: 'SUIUSD', ADA: 'ADAUSD',
  DOT: 'DOTUSD', LINK: 'LINKUSD', UNI: 'UNIUSD', ATOM: 'ATOMUSD',
  XRP: 'XRPUSD', DOGE: 'XDGUSD', LTC: 'LTCUSD',
};

const KRAKEN_INTERVAL_MAP: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
};

/**
 * Kraken OHLC — geo-unrestricted fallback for Binance klines.
 * Returns data in BinanceKline format for drop-in compatibility.
 */
export async function getKrakenKlines(asset: string, interval = '1h', limit = 100): Promise<BinanceKline[] | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const pair = KRAKEN_PAIR_MAP[a];
  if (!pair) return null; // asset not on Kraken (e.g. BNB)
  const krakenInterval = KRAKEN_INTERVAL_MAP[interval] ?? 60;
  return safe(cachedFetch(`kraken:klines:${pair}:${krakenInterval}:${limit}`, async () => {
    const r = await krakenHttp.get('/0/public/OHLC', { params: { pair, interval: krakenInterval } });
    if (r.data.error?.length) throw new Error(`Kraken error: ${r.data.error[0]}`);
    const pairKey = Object.keys(r.data.result).find(k => k !== 'last')!;
    const candles: any[][] = r.data.result[pairKey];
    // Kraken: [time, open, high, low, close, vwap, volume, count]
    const sliced = limit < candles.length ? candles.slice(-limit) : candles;
    const intervalMs = krakenInterval * 60 * 1000;
    return sliced.map((k: any[]) => ({
      openTime: Number(k[0]) * 1000,
      open: Number(k[1]), high: Number(k[2]),
      low: Number(k[3]), close: Number(k[4]),
      volume: Number(k[6]),
      closeTime: Number(k[0]) * 1000 + intervalMs - 1,
      quoteVolume: Number(k[5]) * Number(k[6]), // vwap * vol ≈ quote vol
      trades: Number(k[7]),
    }));
  }, 60));
}

// ============================================================================
// OKX — free public ticker, no API key required
// ============================================================================
const okxHttp = axios.create({ baseURL: 'https://www.okx.com', timeout: 8000 });

const OKX_INST_MAP: Record<string, string> = {
  BTC: 'BTC-USDT', ETH: 'ETH-USDT', SOL: 'SOL-USDT', BNB: 'BNB-USDT',
  AVAX: 'AVAX-USDT', LINK: 'LINK-USDT', DOGE: 'DOGE-USDT', ARB: 'ARB-USDT',
  OP: 'OP-USDT', SUI: 'SUI-USDT', DOT: 'DOT-USDT', ADA: 'ADA-USDT',
  XRP: 'XRP-USDT', LTC: 'LTC-USDT', ATOM: 'ATOM-USDT', UNI: 'UNI-USDT',
  AAVE: 'AAVE-USDT', INJ: 'INJ-USDT', TIA: 'TIA-USDT', JUP: 'JUP-USDT',
  WIF: 'WIF-USDT', PEPE: 'PEPE-USDT', SHIB: 'SHIB-USDT', ZEC: 'ZEC-USDT',
};

/** OKX spot ticker — returns { price, change24h } or null */
export async function getOKXTicker(asset: string): Promise<{ price: number; change24h: number; vol24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const instId = OKX_INST_MAP[a] ?? `${a}-USDT`;
  return cachedFetch(`okx:ticker:${instId}`, async () => {
    const r = await okxHttp.get('/api/v5/market/ticker', { params: { instId } });
    if (r.data?.code !== '0' || !r.data?.data?.[0]) throw new Error('OKX no data');
    const d = r.data.data[0];
    const price = Number(d.last);
    const open24h = Number(d.open24h);
    const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
    return { price, change24h, vol24h: Number(d.volCcy24h ?? d.vol24h ?? 0) };
  }, 15);
}

// ============================================================================
// COINBASE (Advanced Trade public) — no API key for spot prices
// ============================================================================
const coinbaseHttp = axios.create({ baseURL: 'https://api.coinbase.com', timeout: 8000 });

const COINBASE_PAIR_MAP: Record<string, string> = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', AVAX: 'AVAX-USD',
  LINK: 'LINK-USD', DOGE: 'DOGE-USD', ADA: 'ADA-USD', DOT: 'DOT-USD',
  XRP: 'XRP-USD', LTC: 'LTC-USD', ATOM: 'ATOM-USD', UNI: 'UNI-USD',
  AAVE: 'AAVE-USD', ARB: 'ARB-USD', OP: 'OP-USD', SUI: 'SUI-USD',
  MATIC: 'MATIC-USD', INJ: 'INJ-USD', SHIB: 'SHIB-USD', PEPE: 'PEPE-USD',
};

/** Coinbase spot ticker — returns { price, change24h } or null */
export async function getCoinbaseTicker(asset: string): Promise<{ price: number; change24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const pair = COINBASE_PAIR_MAP[a] ?? `${a}-USD`;
  return cachedFetch(`coinbase:ticker:${pair}`, async () => {
    // Advanced Trade public products endpoint
    const r = await coinbaseHttp.get(`/api/v3/brokerage/market/products/${pair}`);
    const d = r.data;
    const price = Number(d.price ?? d.best_bid ?? 0);
    const open24h = Number(d.price_percentage_change_24h ?? 0);
    return { price, change24h: open24h };
  }, 15);
}

// ============================================================================
// BYBIT — free public ticker, no API key
// ============================================================================
const bybitHttp = axios.create({ baseURL: 'https://api.bybit.com', timeout: 8000 });

const BYBIT_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  AVAX: 'AVAXUSDT', LINK: 'LINKUSDT', DOGE: 'DOGEUSDT', ARB: 'ARBUSDT',
  OP: 'OPUSDT', SUI: 'SUIUSDT', DOT: 'DOTUSDT', ADA: 'ADAUSDT',
  XRP: 'XRPUSDT', LTC: 'LTCUSDT', ATOM: 'ATOMUSDT', UNI: 'UNIUSDT',
  AAVE: 'AAVEUSDT', INJ: 'INJUSDT', TIA: 'TIAUSDT', PEPE: '1000PEPEUSDT',
  SHIB: '1000SHIBUSDT', WIF: 'WIFUSDT', JUP: 'JUPUSDT', ZEC: 'ZECUSDT',
};

/** Bybit spot ticker — returns { price, change24h } or null */
export async function getBybitTicker(asset: string): Promise<{ price: number; change24h: number; vol24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const symbol = BYBIT_SYMBOL_MAP[a] ?? `${a}USDT`;
  return cachedFetch(`bybit:ticker:${symbol}`, async () => {
    const r = await bybitHttp.get('/v5/market/tickers', { params: { category: 'spot', symbol } });
    if (r.data?.retCode !== 0 || !r.data?.result?.list?.[0]) throw new Error('Bybit no data');
    const d = r.data.result.list[0];
    return {
      price: Number(d.lastPrice),
      change24h: Number(d.price24hPcnt ?? 0) * 100,
      vol24h: Number(d.turnover24h ?? 0),
    };
  }, 15);
}

// ============================================================================
// KUCOIN — free public ticker, no API key
// ============================================================================
const kucoinHttp = axios.create({ baseURL: 'https://api.kucoin.com', timeout: 8000 });

const KUCOIN_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTC-USDT', ETH: 'ETH-USDT', SOL: 'SOL-USDT', AVAX: 'AVAX-USDT',
  LINK: 'LINK-USDT', DOGE: 'DOGE-USDT', ADA: 'ADA-USDT', DOT: 'DOT-USDT',
  XRP: 'XRP-USDT', LTC: 'LTC-USDT', ATOM: 'ATOM-USDT', UNI: 'UNI-USDT',
  AAVE: 'AAVE-USDT', ARB: 'ARB-USDT', OP: 'OP-USDT', SUI: 'SUI-USDT',
  INJ: 'INJ-USDT', TIA: 'TIA-USDT', JUP: 'JUP-USDT', WIF: 'WIF-USDT',
  PEPE: 'PEPE-USDT', SHIB: 'SHIB-USDT',
};

/** KuCoin spot ticker — returns { price, change24h } or null */
export async function getKuCoinTicker(asset: string): Promise<{ price: number; change24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const symbol = KUCOIN_SYMBOL_MAP[a] ?? `${a}-USDT`;
  return cachedFetch(`kucoin:ticker:${symbol}`, async () => {
    const r = await kucoinHttp.get('/api/v1/market/stats', { params: { symbol } });
    if (r.data?.code !== '200000' || !r.data?.data) throw new Error('KuCoin no data');
    const d = r.data.data;
    return {
      price: Number(d.last),
      change24h: Number(d.changeRate ?? 0) * 100,
    };
  }, 15);
}

// ============================================================================
// MEXC — free public ticker, no API key
// ============================================================================
const mexcHttp = axios.create({ baseURL: 'https://api.mexc.com', timeout: 8000 });

/** MEXC spot 24hr ticker — returns { price, change24h } or null */
export async function getMEXCTicker(asset: string): Promise<{ price: number; change24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const symbol = `${a}USDT`;
  return cachedFetch(`mexc:ticker:${symbol}`, async () => {
    const r = await mexcHttp.get('/api/v3/ticker/24hr', { params: { symbol } });
    return {
      price: Number(r.data.lastPrice),
      change24h: Number(r.data.priceChangePercent ?? 0),
    };
  }, 15);
}

// ============================================================================
// GATE.IO — free public ticker, no API key
// ============================================================================
const gateHttp = axios.create({ baseURL: 'https://api.gateio.ws', timeout: 8000 });

/** Gate.io spot ticker — returns { price, change24h } or null */
export async function getGateIOTicker(asset: string): Promise<{ price: number; change24h: number } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  const currencyPair = `${a}_USDT`;
  return cachedFetch(`gateio:ticker:${currencyPair}`, async () => {
    const r = await gateHttp.get('/api/v4/spot/tickers', { params: { currency_pair: currencyPair } });
    const d = r.data?.[0];
    if (!d) throw new Error('Gate.io no data');
    return {
      price: Number(d.last),
      change24h: Number(d.change_percentage ?? 0),
    };
  }, 15);
}

/**
 * Multi-exchange price waterfall: Binance → OKX → Bybit → KuCoin → Coinbase → MEXC → Gate.io → Kraken → CoinGecko
 * Returns the first successful { price, change24h, source } or null.
 */
export async function getPriceFromAnyExchange(asset: string): Promise<{ price: number; change24h: number; vol24h?: number; source: string } | null> {
  const a = asset.toUpperCase().replace(/^V/, '').replace(/(USDT|BUSD|USDC|USD)$/, '');
  type RawResult = { price: number; change24h: number; vol24h?: number; source: string } | null;

  // Run first batch in parallel (fastest tier — CEX REST)
  const [bin, okx, bybit] = await Promise.all([
    getBinanceTicker(a).then(t => t && t.price > 0 ? { price: t.price, change24h: t.priceChangePercent, vol24h: t.quoteVolume, source: 'binance' } : null).catch(() => null),
    getOKXTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'okx' } : null).catch(() => null),
    getBybitTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'bybit' } : null).catch(() => null),
  ] as Promise<RawResult>[]);
  if (bin) return bin;
  if (okx) return okx;
  if (bybit) return bybit;

  // Second tier
  const [kucoin, coinbase, mexc] = await Promise.all([
    getKuCoinTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'kucoin' } : null).catch(() => null),
    getCoinbaseTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'coinbase' } : null).catch(() => null),
    getMEXCTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'mexc' } : null).catch(() => null),
  ] as Promise<RawResult>[]);
  if (kucoin) return kucoin;
  if (coinbase) return coinbase;
  if (mexc) return mexc;

  // Third tier
  const [gate, kraken, coingecko] = await Promise.all([
    getGateIOTicker(a).then(t => t && t.price > 0 ? { ...t, source: 'gate.io' } : null).catch(() => null),
    (() => {
      const pair = KRAKEN_PAIR_MAP[a];
      if (!pair) return Promise.resolve(null);
      return safe(
        krakenHttp.get('/0/public/Ticker', { params: { pair } }).then(r => {
          if (r.data.error?.length) throw new Error('Kraken error');
          const pairKey = Object.keys(r.data.result)[0];
          const d = r.data.result[pairKey];
          const price = Number(d.c[0]);
          const open24h = Number(d.o);
          const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
          return { price, change24h, source: 'kraken' };
        })
      );
    })(),
    getCoinGeckoPrices([a]).then(r => {
      const d = r?.[a];
      return d?.usd ? { price: d.usd, change24h: d.usd_24h_change ?? 0, source: 'coingecko' } : null;
    }).catch(() => null),
  ] as Promise<RawResult>[]);
  return gate ?? kraken ?? coingecko ?? null;
}

/**
 * GET /api/v3/ticker/price — simple latest price only.
 * Fastest Binance price endpoint, lowest weight.
 */
export async function getBinancePrice(asset: string): Promise<number | null> {
  const sym = toBinanceSymbol(asset);
  return cachedFetch(`binance:price:${sym}`, async () => {
    const r = await binanceHttp.get('/api/v3/ticker/price', { params: { symbol: sym } });
    return Number(r.data.price);
  }, 10); // 10s cache
}

/**
 * GET /api/v3/depth — order book top N levels.
 */
export async function getBinanceOrderbook(asset: string, limit = 5): Promise<{ bids: [number, number][]; asks: [number, number][] } | null> {
  const sym = toBinanceSymbol(asset);
  return safe(binanceHttp.get('/api/v3/depth', { params: { symbol: sym, limit } }).then(r => ({
    bids: (r.data.bids as string[][]).map(b => [Number(b[0]), Number(b[1])] as [number, number]),
    asks: (r.data.asks as string[][]).map(a => [Number(a[0]), Number(a[1])] as [number, number]),
  })));
}

/**
 * GET multiple prices at once — Binance supports batch with symbols param or all.
 */
export async function getBinancePrices(assets: string[]): Promise<Record<string, number>> {
  const syms = assets.map(a => toBinanceSymbol(a));
  return cachedFetch(`binance:prices:${syms.join(',')}`, async () => {
    const r = await binanceHttp.get('/api/v3/ticker/price');
    const all: any[] = r.data;
    const map: Record<string, number> = {};
    for (const item of all) {
      const asset = Object.entries(BINANCE_SYMBOL_MAP).find(([, v]) => v === item.symbol)?.[0];
      if (asset) map[asset] = Number(item.price);
    }
    return map;
  }, 15);
}

// ============================================================================
// DEFILLAMA — free, no API key
// ============================================================================

export interface DefiLlamaProtocol {
  name: string;
  slug: string;
  tvl: number;
  change_1h?: number;
  change_1d?: number;
  change_7d?: number;
  category?: string;
  chains?: string[];
}

/**
 * GET /protocols — top DeFi protocols by TVL.
 */
export async function getDefiProtocols(limit = 20): Promise<DefiLlamaProtocol[] | null> {
  return cachedFetch(`defillama:protocols:${limit}`, async () => {
    const r = await llamaHttp.get('/protocols');
    const all: any[] = r.data;
    return all.slice(0, limit).map(p => ({
      name: p.name, slug: p.slug, tvl: Number(p.tvl),
      change_1h: p.change_1h, change_1d: p.change_1d, change_7d: p.change_7d,
      category: p.category, chains: p.chains,
    }));
  }, 300); // 5 min cache
}

/**
 * GET /v2/historicalChainTvl — total DeFi TVL over time.
 */
export async function getDefiTotalTVL(): Promise<{ date: number; tvl: number }[] | null> {
  return cachedFetch('defillama:totaltvl', async () => {
    const r = await llamaHttp.get('/v2/historicalChainTvl');
    return (r.data as any[]).slice(-30).map(d => ({ date: d.date, tvl: d.tvl }));
  }, 600); // 10 min cache
}

/**
 * GET /v2/chains — current TVL by chain.
 */
export async function getDefiChains(): Promise<{ name: string; tvl: number }[] | null> {
  return cachedFetch('defillama:chains', async () => {
    const r = await llamaHttp.get('/v2/chains');
    return (r.data as any[])
      .sort((a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0))  // sort by TVL descending
      .slice(0, 15)
      .map(c => ({ name: c.name, tvl: Number(c.tvl) }));
  }, 300);
}

/**
 * GET /stablecoins — stablecoin market cap data.
 */
export async function getDefiStablecoins(): Promise<{ name: string; symbol: string; circulating: number }[] | null> {
  return cachedFetch('defillama:stablecoins', async () => {
    const r = await llamaHttp.get('/stablecoins');
    const items: any[] = r.data?.peggedAssets || [];
    return items.slice(0, 10).map(s => ({
      name: s.name, symbol: s.symbol,
      circulating: Number(s.circulating?.peggedUSD ?? 0),
    }));
  }, 600);
}

/**
 * GET /yields/pools — top yield pools by APY.
 */
export async function getDefiYields(limit = 10): Promise<{ pool: string; project: string; chain: string; apy: number; tvlUsd: number }[] | null> {
  return cachedFetch(`defillama:yields:${limit}`, async () => {
    const r = await llamaHttp.get('/yields/pools');
    const pools: any[] = r.data?.data || [];
    return pools
      .filter(p => p.apy > 0 && p.tvlUsd > 100_000)
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit)
      .map(p => ({ pool: p.pool, project: p.project, chain: p.chain, apy: p.apy, tvlUsd: p.tvlUsd }));
  }, 600);
}

// ============================================================================
// COINGECKO — optional COINGECKO_API_KEY (demo tier, ~30 req/min)
// ============================================================================

function geckoHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { 'x-cg-demo-api-key': key } : {};
}

export interface CoinGeckoGlobal {
  activeCryptocurrencies: number;
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChangePercent24h: number;
  defiTotalMarketCapUsd?: number;
}

/**
 * GET /global — overall crypto market summary.
 */
export async function getCoinGeckoGlobal(): Promise<CoinGeckoGlobal | null> {
  return cachedFetch('coingecko:global', async () => {
    const r = await geckoHttp.get('/global', { headers: geckoHeaders() });
    const d = r.data?.data;
    return {
      activeCryptocurrencies: d.active_cryptocurrencies,
      totalMarketCapUsd: d.total_market_cap?.usd ?? 0,
      totalVolumeUsd: d.total_volume?.usd ?? 0,
      btcDominance: d.market_cap_percentage?.btc ?? 0,
      ethDominance: d.market_cap_percentage?.eth ?? 0,
      marketCapChangePercent24h: d.market_cap_change_percentage_24h_usd ?? 0,
      defiTotalMarketCapUsd: d.defi_market_cap ? Number(d.defi_market_cap) : undefined,
    };
  }, 120); // 2 min cache
}

export interface CoinGeckoPrice {
  usd: number;
  usd_market_cap?: number;
  usd_24h_change?: number;
  usd_24h_vol?: number;
}

/**
 * GET /simple/price — real-time prices for multiple assets.
 */
export async function getCoinGeckoPrices(assets: string[]): Promise<Record<string, CoinGeckoPrice> | null> {
  const ids = assets.map(a => toCoinGeckoId(a)).join(',');
  return cachedFetch(`coingecko:prices:${ids}`, async () => {
    const r = await geckoHttp.get('/simple/price', {
      headers: geckoHeaders(),
      params: { ids, vs_currencies: 'usd', include_market_cap: true, include_24hr_change: true, include_24hr_vol: true },
    });
    const result: Record<string, CoinGeckoPrice> = {};
    for (const asset of assets) {
      const id = toCoinGeckoId(asset);
      if (r.data[id]) result[asset.toUpperCase()] = r.data[id];
    }
    return result;
  }, 20); // 20s cache
}

/**
 * GET /trending — trending coins (top 15 searched coins in 24h).
 */
export async function getCoinGeckoTrending(): Promise<{ id: string; name: string; symbol: string; score: number }[] | null> {
  return cachedFetch('coingecko:trending', async () => {
    const r = await geckoHttp.get('/search/trending', { headers: geckoHeaders() });
    return (r.data?.coins || []).map((c: any) => ({
      id: c.item.id, name: c.item.name, symbol: c.item.symbol, score: c.item.score,
    }));
  }, 300); // 5 min cache
}

// ============================================================================
// CRYPTOPANIC — optional CRYPTOPANIC_API_KEY (free dev tier ~1000 req/month)
// ============================================================================

export interface CryptoPanicPost {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  domain: string;
  currencies: string[];
  votes: { positive: number; negative: number; important: number };
  kind: string;
}

/**
 * GET /posts/ — curated crypto news, optionally filtered by asset.
 * Requires CRYPTOPANIC_API_KEY env var (free registration at cryptopanic.com).
 */
export async function getCryptoPanicNews(asset?: string, filter: 'hot' | 'rising' | 'bullish' | 'bearish' | 'important' = 'hot', limit = 10): Promise<CryptoPanicPost[] | null> {
  const token = process.env.CRYPTOPANIC_API_KEY;
  if (!token) return null; // skip gracefully if no key

  const cacheKey = `cryptopanic:news:${asset ?? 'all'}:${filter}`;
  return cachedFetch(cacheKey, async () => {
    const params: any = { auth_token: token, filter, regions: 'en', public: 'true' };
    if (asset) params.currencies = asset.toUpperCase().replace(/^V/, '');
    const r = await panicHttp.get('/posts/', { params });
    const posts: any[] = r.data?.results || [];
    return posts.slice(0, limit).map(p => ({
      id: p.id, title: p.title, url: p.url, publishedAt: p.published_at,
      domain: p.domain || p.source?.domain || '',
      currencies: (p.currencies || []).map((c: any) => c.code),
      votes: { positive: p.votes?.positive ?? 0, negative: p.votes?.negative ?? 0, important: p.votes?.important ?? 0 },
      kind: p.kind,
    }));
  }, 120); // 2 min cache
}

// ============================================================================
// Unified price resolver — tries all sources in priority order
// ============================================================================

/**
 * Get best available spot price for an asset.
 * Priority: Binance (no key) → CoinGecko (key optional) → null
 */
export async function getSpotPrice(asset: string): Promise<number | null> {
  // 1. Binance (fastest, no key)
  const binPrice = await safe(getBinancePrice(asset));
  if (binPrice && binPrice > 0) return binPrice;

  // 2. CoinGecko fallback
  const cgPrices = await safe(getCoinGeckoPrices([asset]));
  const cgPrice = cgPrices?.[asset.toUpperCase()]?.usd;
  if (cgPrice && cgPrice > 0) return cgPrice;

  return null;
}

/**
 * Aggregate market context for a given asset — used by research agent.
 * Returns all data in a structured object; null fields mean source unavailable.
 */
export async function getMarketContext(asset: string) {
  const [ticker, klines, global, defiChains, trending, news] = await Promise.all([
    // Binance first; fall back to multi-exchange waterfall so price is never null
    safe(getBinanceTicker(asset).then(t => t ?? getPriceFromAnyExchange(asset).then(p => p ? {
      symbol: `${asset}USDT`, price: p.price, priceChange: 0,
      priceChangePercent: p.change24h, highPrice: p.price * 1.01, lowPrice: p.price * 0.99,
      volume: (p.vol24h ?? 0), quoteVolume: (p.vol24h ?? 0),
      bidPrice: p.price, askPrice: p.price, count: 0,
    } : null))),
    safe(getBinanceKlines(asset, '1h', 24)),
    safe(getCoinGeckoGlobal()),
    safe(getDefiChains()),
    safe(getCoinGeckoTrending()),
    safe(getCryptoPanicNews(asset, 'hot', 8)),
  ]);

  return { ticker, klines, global, defiChains, trending, news };
}
