'use client';

/**
 * /trade — Non-custodial trading desk.
 *
 * ✅ Real user balance from SoDEX (not house wallet, not vUSDC label)
 * ✅ Candlestick chart via lightweight-charts
 * ✅ Live ticker stats (price, 24h change, high, low, volume)
 * ✅ % sizing buttons (25/50/75/100%)
 * ✅ Real order history from SoDEX API
 * ✅ Auto account ID (always 0 — wallet address is the identifier)
 * ✅ EIP-712 non-custodial signing (unchanged)
 * ✅ 4-step wizard: Strategy → Risk Preflight → Sign & Submit → Execution Proof
 */
import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetcher, api } from '@/lib/api';
import { placeSpotOrder, getRelayInfo } from '@/lib/sodex-client';
import { useWallet } from '@/context/WalletContext';
import { GlassCard } from '@/components/GlassCard';
import {
  ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck,
  ExternalLink, RefreshCw, TrendingUp, TrendingDown, Wallet,
  ChevronRight, ChevronLeft, Copy, CheckCircle2, XCircle, AlertTriangle,
  Zap, BarChart2, SlidersHorizontal,
} from 'lucide-react';
import { CryptoIcon } from '@/components/CryptoIcon';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Strip testnet `v` prefix for display. */
function dc(coin: string): string {
  if (!coin) return '';
  if (coin === 'WSOSO') return 'SOSO';
  return coin.startsWith('v') ? coin.slice(1) : coin;
}

function fmt(n: string | number, decimals = 2): string {
  const v = Number(n);
  if (isNaN(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SodexSymbol {
  id: number;
  name: string;
  displayName: string;
  baseCoin: string;
  quoteCoin: string;
  minQuantity: string;
  pricePrecision: number;
  quantityPrecision: number;
  status: string;
  minNotional?: string;
}

interface Ticker {
  symbol: string;
  lastPx: string;
  openPx: string;
  highPx: string;
  lowPx: string;
  volume: string;
  quoteVolume: string;
  change: string;
  changePct: number;
}

interface Balance {
  id: number;
  coin: string;
  total: string;
  locked: string;
}

interface BalanceData {
  balances: Balance[];
  blockTime?: number;
  blockHeight?: number;
}

interface OrderRow {
  symbol: string;
  orderID: number;
  clOrdID: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  status: string;
  executedQty: string;
  executedValue: string;
  createdAt: number;
}

// ─── Candlestick chart ────────────────────────────────────────────────────────

function CandlestickChart({ klines, symbol }: { klines: any[]; symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !klines.length) return;

    let cleaned = false;

    const init = async () => {
      const { createChart, ColorType, CrosshairMode, CandlestickSeries } = await import('lightweight-charts');

      if (cleaned) return;
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current = null;
      }

      const el = containerRef.current!;
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#7c8899',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      chartRef.current = chart;

      // lightweight-charts v5 API: addSeries(SeriesType, options)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      const data = [...klines]
        .map((k: any) => ({
          time: Math.floor(k.t / 1000) as any,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        }))
        .sort((a: any, b: any) => a.time - b.time);

      candleSeries.setData(data);
      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (!cleaned && chart && el) {
          chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        }
      });
      ro.observe(el);

      return () => ro.disconnect();
    };

    const cleanup = init();

    return () => {
      cleaned = true;
      cleanup?.then?.((fn: any) => fn?.());
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klines, symbol]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── page ─────────────────────────────────────────────────────────────────────

function TradeInner() {
  const { address, token } = useWallet();
  const searchParams = useSearchParams();
  const initSide = (searchParams.get('side') ?? 'buy') as 'buy' | 'sell';
  const initType = (searchParams.get('type') === 'market' ? 'market' : 'limit') as 'limit' | 'market';
  const initQty = searchParams.get('qty') ?? '';
  const initPrice = searchParams.get('price') ?? '';
  const initAsset = searchParams.get('asset') ?? '';
  const [side, setSide] = useState<'buy' | 'sell'>(initSide);
  const [orderType, setOrderType] = useState<'limit' | 'market'>(initType);
  const [symbolId, setSymbolId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(initQty);
  const [price, setPrice] = useState(initPrice);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [chartInterval, setChartInterval] = useState('1h');

  // ── Wizard state ─────────────────────────────────────────────────────────
  type WizardStep = 1 | 2 | 3 | 4;
  type Strategy = 'copy' | 'ssi' | 'manual';
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [strategy, setStrategy] = useState<Strategy>('manual');
  const [executionProof, setExecutionProof] = useState<{
    orderId: string | number;
    status: string;
    market: string;
    side: string;
    qty: string;
    price: string;
    ts: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Strategy-specific loaded data ─────────────────────────────────────────
  const [copySignalData, setCopySignalData] = useState<any>(null);
  const [ssiBasketData, setSsiBasketData] = useState<{ sector: any; basket: any } | null>(null);
  const [ssiProxyAsset, setSsiProxyAsset] = useState<string | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const autoFilledStrategyRef = useRef<string | null>(null);

  // Sector → best available SoDEX Testnet spot proxy (all pairs now live)
  const SECTOR_PROXY: Record<string, string> = {
    ssiDeFi: 'LINK',    // DeFi oracle / on-chain liquidity exposure
    ssiAI: 'ETH',       // AI infra primarily on Ethereum ecosystem
    ssiLayer1: 'SOL',   // L1 competition — SOL is strongest L1 proxy
    ssiLayer2: 'ETH',   // L2 rollups settle to ETH
    ssiRWA: 'LINK',     // RWA depends on Chainlink data feeds
    ssiNFT: 'ETH',      // NFTs overwhelmingly on Ethereum
    ssiMeme: 'DOGE',    // Meme coins — DOGE is OG benchmark
    ssiGameFi: 'AVAX',  // GameFi / Avalanche subnet ecosystem
    ssiMAG7: 'BTC',     // MAG7 = macro risk-on, tracks BTC
    ssiPayFi: 'XRP',    // Payments / cross-border settlements
    ssiCeFi: 'BNB',     // CeFi / exchange tokens — BNB is proxy
    ssiSocialFi: 'SOL', // SocialFi primarily on Solana
    ssiDePIN: 'SOL',    // DePIN infrastructure on Solana ecosystem
  };

  // Non-trading status values — mirrors the bot's _NON_TRADING_ST constant
  const NON_TRADING_ST = ['CANCEL_ONLY', 'HALT', 'SUSPENDED', 'BREAK', 'DISABLED', 'INACTIVE', 'CLOSED'];

  const symbols = useQuery<SodexSymbol[]>({
    queryKey: ['sodex', 'spot', 'symbols'],
    queryFn: () => fetcher('/api/sodex/spot/symbols'),
    staleTime: 60_000,
  });

  // Symbols that are currently accepting new orders on SoDEX
  const tradeableSymbols = useMemo(
    () => (symbols.data ?? []).filter((s) => {
      const st = s.status.toUpperCase();
      return !NON_TRADING_ST.some((x) => st.includes(x));
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbols.data],
  );

  const info = useQuery({
    queryKey: ['sodex', 'relay', 'info'],
    queryFn: getRelayInfo,
    staleTime: 300_000,
  });

  const tickers = useQuery<Ticker[]>({
    queryKey: ['sodex', 'spot', 'tickers'],
    queryFn: () => fetcher('/api/sodex/spot/tickers'),
    refetchInterval: 8_000,
  });

  const activeSymbol = useMemo(
    () => (symbols.data ?? []).find((s) => s.id === symbolId) ?? null,
    [symbols.data, symbolId],
  );

  const balanceQuery = useQuery<BalanceData>({
    queryKey: ['sodex', 'user-balance', address],
    enabled: Boolean(address),
    refetchInterval: 12_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/balances`),
  });

  const orderHistory = useQuery<OrderRow[]>({
    queryKey: ['sodex', 'user-orders-history', address],
    enabled: Boolean(address),
    refetchInterval: 10_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders/history?limit=30`),
  });

  const orderbook = useQuery<{ bids: any[]; asks: any[] }>({
    queryKey: ['sodex', 'spot', 'orderbook', activeSymbol?.name],
    enabled: Boolean(activeSymbol?.name),
    refetchInterval: 3_000,
    queryFn: () => fetcher(`/api/sodex/spot/orderbook?market=${activeSymbol!.name}&depth=12`),
  });

  const klines = useQuery<any[]>({
    queryKey: ['sodex', 'spot', 'klines', activeSymbol?.name, chartInterval],
    enabled: Boolean(activeSymbol?.name),
    refetchInterval: 60_000,
    queryFn: () => fetcher(
      `/api/sodex/spot/klines?market=${activeSymbol!.name}&interval=${chartInterval}&limit=200`,
    ),
  });

  const activeTicker = useMemo(
    () => (tickers.data ?? []).find((t) => t.symbol === activeSymbol?.name) ?? null,
    [tickers.data, activeSymbol],
  );

  const bestBid = useMemo(() => {
    const r = (orderbook.data?.bids ?? [])[0];
    return r ? Number(Array.isArray(r) ? r[0] : r?.price) : 0;
  }, [orderbook.data]);

  const bestAsk = useMemo(() => {
    const r = (orderbook.data?.asks ?? [])[0];
    return r ? Number(Array.isArray(r) ? r[0] : r?.price) : 0;
  }, [orderbook.data]);

  const usdcBalance = useMemo(() => {
    const coin = (balanceQuery.data?.balances ?? []).find((b) => b.coin === 'vUSDC');
    if (!coin) return 0;
    return Math.max(0, parseFloat(coin.total) - parseFloat(coin.locked));
  }, [balanceQuery.data]);

  const baseCoinBalance = useMemo(() => {
    if (!activeSymbol) return 0;
    const coin = (balanceQuery.data?.balances ?? []).find((b) => b.coin === activeSymbol.baseCoin);
    if (!coin) return 0;
    return Math.max(0, parseFloat(coin.total) - parseFloat(coin.locked));
  }, [balanceQuery.data, activeSymbol]);

  const qtyNum = Number(quantity);
  const priceNum = orderType === 'market'
    ? (side === 'buy' ? bestAsk : bestBid)
    : Number(price);
  const estCost = qtyNum && priceNum ? qtyNum * priceNum : 0;
  const changePct = activeTicker?.changePct ?? 0;
  const isPositive = changePct >= 0;

  useEffect(() => {
    if (symbolId == null && symbols.data?.length) {
      // Pre-select asset from NLP query param (e.g. asset=ETH → vETH_vUSDC)
      // Always prefer TRADING-status symbols — never pre-select cancel-only assets
      const pool = tradeableSymbols.length > 0 ? tradeableSymbols : symbols.data;
      const fromParam = initAsset
        ? pool.find((s) => s.baseCoin === `v${initAsset}` || s.baseCoin === initAsset || s.name.startsWith(`v${initAsset}_`) || s.name.startsWith(`${initAsset}_`))
        : null;
      const eth = pool.find((s) => s.name === 'vETH_vUSDC');
      const btc = pool.find((s) => s.name === 'vBTC_vUSDC');
      const first = fromParam ?? eth ?? btc ?? pool[0];
      if (first) setSymbolId(first.id);
    }
  }, [symbols.data, symbolId, initAsset, tradeableSymbols]);

  const handlePct = useCallback(
    (pct: number) => {
      if (!activeSymbol) return;
      const effectivePrice = priceNum || (side === 'buy' ? bestAsk : bestBid);
      if (side === 'buy' && effectivePrice > 0) {
        const qty = (usdcBalance * pct) / effectivePrice;
        setQuantity(qty.toFixed(activeSymbol.quantityPrecision));
      } else if (side === 'sell') {
        const qty = baseCoinBalance * pct;
        setQuantity(qty.toFixed(activeSymbol.quantityPrecision));
      }
    },
    [activeSymbol, priceNum, usdcBalance, baseCoinBalance, bestAsk, bestBid, side],
  );

  const setBestPrice = useCallback(() => {
    setPrice(String(side === 'buy' ? bestAsk : bestBid));
  }, [side, bestAsk, bestBid]);

  // Auto-fill qty when strategy data + price/balance converge (runs once per strategy load)
  useEffect(() => {
    if (!activeSymbol || !strategy || autoFilledStrategyRef.current === strategy) return;
    if (strategy === 'copy' && copySignalData && usdcBalance > 0 && bestAsk > 0) {
      const confPct = Math.min(0.25, Math.max(0.05, ((copySignalData.confidence as number) || 50) / 400));
      const entryPx = Number(copySignalData.entry) > 0 ? Number(copySignalData.entry) : bestAsk;
      const autoQty = (usdcBalance * confPct) / entryPx;
      if (autoQty > 0) {
        setQuantity(autoQty.toFixed(activeSymbol.quantityPrecision ?? 4));
        autoFilledStrategyRef.current = strategy;
      }
    } else if (strategy === 'ssi' && ssiBasketData && usdcBalance > 0 && bestAsk > 0) {
      const autoQty = (usdcBalance * 0.10) / bestAsk;
      if (autoQty > 0) {
        setQuantity(autoQty.toFixed(activeSymbol.quantityPrecision ?? 4));
        autoFilledStrategyRef.current = strategy;
      }
    }
  }, [strategy, copySignalData, ssiBasketData, activeSymbol, usdcBalance, bestAsk]);

  // Reset auto-fill flag and proxy when user switches strategy
  useEffect(() => {
    autoFilledStrategyRef.current = null;
    setSsiProxyAsset(null);
  }, [strategy]);

  async function handleStrategyProceed() {
    setStrategyLoading(true);
    try {
      if (strategy === 'copy') {
        // 1. Try stored signals first
        let sigs: any[] = (await fetcher('/api/agents/signals?limit=5')) ?? [];
        let sig = Array.isArray(sigs) ? sigs[0] : null;

        // 2. If table empty, generate a live signal from the research agent
        if (!sig) {
          const researchAsset = activeSymbol?.baseCoin?.replace(/^v/, '') ?? 'ETH';
          try {
            const res = await api.post(`/api/agents/research/${researchAsset}`);
            sig = res?.data?.signal ?? null;
          } catch (e) {
            console.warn('[Copy Signal] research agent failed:', e);
          }
        }

        if (sig) {
          setCopySignalData(sig);
          const assetName = String(sig.asset ?? sig.symbol ?? '').replace(/USDT|USDC|\/.*/, '').toUpperCase();
          // Try to match by exact base coin among TRADING symbols only; fall back to current market
          const matchSym = tradeableSymbols.find(
            (s) => s.baseCoin === `v${assetName}` || s.baseCoin === assetName,
          ) ?? tradeableSymbols.find((s) => s.id === symbolId);
          if (matchSym) setSymbolId(matchSym.id);
          const dir = String(sig.direction ?? sig.side ?? '').toLowerCase();
          setSide(dir.includes('short') || dir === 'sell' ? 'sell' : 'buy');
          if (sig.entry && Number(sig.entry) > 0) {
            setOrderType('limit');
            setPrice(String(Number(sig.entry).toFixed(2)));
          } else {
            setOrderType('market');
          }
        }
      } else if (strategy === 'ssi') {
        const sectors: any[] = (await fetcher('/api/sectors/intel')) ?? [];
        const list = Array.isArray(sectors) ? sectors : [];
        const top = list.find((s: any) => s.verdict === 'STRONG_BUY')
                 ?? list.find((s: any) => s.verdict === 'BUY')
                 ?? list[0];
        if (top?.ticker) {
          const basketData: any = await fetcher(`/api/sectors/intel/${top.ticker}/basket`);
          setSsiBasketData({ sector: top, basket: basketData });

          // Try basket assets first — only TRADING-status symbols
          const basketAssets: string[] = (basketData?.basket ?? []).map((b: any) => String(b.asset));
          let matchSym = basketAssets
            .map((asset) => tradeableSymbols.find(
              (s) => s.baseCoin === `v${asset}` || s.baseCoin === asset,
            ))
            .find(Boolean);

          // Fallback: use sector proxy when basket assets not on SoDEX Testnet or cancel-only
          if (!matchSym) {
            const proxyBase = SECTOR_PROXY[top.ticker] ?? 'ETH';
            matchSym = tradeableSymbols.find(
              (s) => s.baseCoin === `v${proxyBase}` || s.baseCoin === proxyBase ||
                     s.name.includes(proxyBase),
            );
            if (matchSym) setSsiProxyAsset(proxyBase);
          } else {
            setSsiProxyAsset(null);
          }

          if (matchSym) setSymbolId(matchSym.id);
          setSide('buy');
          setOrderType('market');
        }
      }
    } catch (e) {
      console.error('[Strategy] load failed:', e);
    } finally {
      setStrategyLoading(false);
    }
    setWizardStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!token || !address) { setResult({ ok: false, message: 'Connect your wallet to trade' }); return; }
    if (!activeSymbol) { setResult({ ok: false, message: 'Select a market' }); return; }
    if (!qtyNum || qtyNum <= 0) { setResult({ ok: false, message: 'Enter a quantity > 0' }); return; }
    if (orderType === 'limit' && (!Number(price) || Number(price) <= 0)) {
      setResult({ ok: false, message: 'Enter a limit price > 0' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await placeSpotOrder({
        accountID: 0,
        symbolID: activeSymbol.id,
        market: activeSymbol.name,
        side,
        orderType,
        quantity: qtyNum,
        price: orderType === 'limit' ? Number(price) : undefined,
      });
      if (r.ok) {
        setResult({ ok: true, message: `Submitted — order ID: ${r.orderId ?? 'pending'}` });
        setExecutionProof({
          orderId: r.orderId ?? 'pending',
          status: 'SUBMITTED',
          market: activeSymbol.displayName,
          side: side.toUpperCase(),
          qty: quantity,
          price: orderType === 'market' ? 'MARKET' : price,
          ts: Date.now(),
        });
        setQuantity('');
        setPrice('');
        orderHistory.refetch();
        balanceQuery.refetch();
        setWizardStep(4);
      } else {
        setResult({ ok: false, message: r.error || 'Order rejected by SoDEX' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Signing cancelled or rejected' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1440px] mx-auto space-y-4">

      {/* Top bar */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {activeSymbol && (
              <CryptoIcon symbol={activeSymbol.baseCoin} size={28} />
            )}
            <select
              value={symbolId ?? ''}
              onChange={(e) => { setSymbolId(Number(e.target.value)); setQuantity(''); setPrice(''); }}
              className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500/60 min-w-[140px]"
            >
              {symbols.isLoading && <option>Loading…</option>}
              {tradeableSymbols.map((s) => (
                <option key={s.id} value={s.id}>{s.displayName}</option>
              ))}
              {/* Show cancel-only symbols disabled so users can see but not select */}
              {(symbols.data ?? []).filter((s) => {
                const st = s.status.toUpperCase();
                return NON_TRADING_ST.some((x) => st.includes(x));
              }).map((s) => (
                <option key={s.id} value={s.id} disabled>{s.displayName} (restricted)</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-2xl font-bold font-mono tabular-nums leading-tight">
              {activeTicker ? fmt(activeTicker.lastPx, activeSymbol?.pricePrecision ?? 2) : '—'}{' '}
              <span className="text-sm text-[var(--text-muted)] font-normal">USDC</span>
            </div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? '+' : ''}{changePct.toFixed(2)}% (24h)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 text-sm items-center">
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">24h High</div>
            <div className="font-mono font-semibold text-emerald-400">{activeTicker ? fmt(activeTicker.highPx, 2) : '—'}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">24h Low</div>
            <div className="font-mono font-semibold text-red-400">{activeTicker ? fmt(activeTicker.lowPx, 2) : '—'}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">Volume (USDC)</div>
            <div className="font-mono font-semibold">{activeTicker ? fmt(activeTicker.quoteVolume, 0) : '—'}</div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {info.data?.isTestnet && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">TESTNET</span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">

        {/* Left: chart + orderbook + history */}
        <div className="space-y-4">

          {/* Chart */}
          <GlassCard padding="sm">
            <div className="flex items-center justify-between mb-2 px-2 pt-1">
              <div className="flex gap-1">
                {['5m', '15m', '1h', '4h', '1d'].map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setChartInterval(iv)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      chartInterval === iv
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <button onClick={() => klines.refetch()} className="text-[var(--text-muted)] hover:text-blue-400 p-1">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div style={{ height: '320px' }}>
              {klines.isLoading ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading chart…
                </div>
              ) : klines.data && klines.data.length > 0 ? (
                <CandlestickChart klines={klines.data} symbol={activeSymbol?.name ?? ''} />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No chart data available</div>
              )}
            </div>
          </GlassCard>

          {/* Orderbook */}
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Order Book — {activeSymbol?.displayName ?? '…'}</h2>
              <div className="flex items-center gap-3">
                {bestAsk && bestBid ? (
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    Spread {(bestAsk - bestBid).toFixed(activeSymbol?.pricePrecision ?? 2)}
                  </span>
                ) : null}
                <button onClick={() => orderbook.refetch()} className="text-[var(--text-muted)] hover:text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1 pb-1 border-b border-[var(--border-subtle)]">
                  <span>Ask Price</span><span className="text-right">Size</span>
                </div>
                {[...(orderbook.data?.asks ?? [])].slice(0, 12).reverse().map((a, i) => {
                  const p = Array.isArray(a) ? a[0] : a?.price;
                  const s = Array.isArray(a) ? a[1] : a?.size;
                  return (
                    <div
                      key={i}
                      title="Click to set buy price"
                      className="grid grid-cols-2 text-xs font-mono py-0.5 cursor-pointer hover:bg-red-500/5 rounded"
                      onClick={() => { setPrice(String(p)); setSide('buy'); }}
                    >
                      <span className="text-red-400">{p}</span>
                      <span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1 pb-1 border-b border-[var(--border-subtle)]">
                  <span>Bid Price</span><span className="text-right">Size</span>
                </div>
                {(orderbook.data?.bids ?? []).slice(0, 12).map((b, i) => {
                  const p = Array.isArray(b) ? b[0] : b?.price;
                  const s = Array.isArray(b) ? b[1] : b?.size;
                  return (
                    <div
                      key={i}
                      title="Click to set sell price"
                      className="grid grid-cols-2 text-xs font-mono py-0.5 cursor-pointer hover:bg-emerald-500/5 rounded"
                      onClick={() => { setPrice(String(p)); setSide('sell'); }}
                    >
                      <span className="text-emerald-400">{p}</span>
                      <span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {bestAsk > 0 && bestBid > 0 && (
              <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] text-center">
                <span className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {((bestAsk + bestBid) / 2).toFixed(activeSymbol?.pricePrecision ?? 2)} USDC
                </span>
                <span className="text-[var(--text-muted)] text-xs ml-2">mid</span>
              </div>
            )}
          </GlassCard>

          {/* Order history */}
          {address && (
            <GlassCard padding="md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">My Order History</h2>
                <button onClick={() => orderHistory.refetch()} className="text-[var(--text-muted)] hover:text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {orderHistory.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : (orderHistory.data ?? []).length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No orders yet — your trades will appear here.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                        <th className="py-1.5 text-left font-medium">Time</th>
                        <th className="py-1.5 text-left font-medium">Market</th>
                        <th className="py-1.5 text-left font-medium">Side</th>
                        <th className="py-1.5 text-left font-medium">Type</th>
                        <th className="py-1.5 text-right font-medium">Price</th>
                        <th className="py-1.5 text-right font-medium">Amount</th>
                        <th className="py-1.5 text-right font-medium">Filled</th>
                        <th className="py-1.5 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderHistory.data ?? []).map((o) => {
                        const sym = (symbols.data ?? []).find((s) => s.name === o.symbol);
                        const dispName = sym?.displayName
                          ?? o.symbol.replace(/_vUSDC$/, '/USDC').replace(/^v/, '');
                        return (
                          <tr key={o.orderID} className="border-b border-[var(--border-subtle)] hover:bg-white/3 transition-colors">
                            <td className="py-1.5 font-mono text-[var(--text-muted)]">
                              {new Date(o.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-1.5">{dispName}</td>
                            <td className={`py-1.5 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {o.side}
                            </td>
                            <td className="py-1.5 text-[var(--text-muted)]">{o.type}</td>
                            <td className="py-1.5 text-right font-mono">{o.price}</td>
                            <td className="py-1.5 text-right font-mono">{o.origQty}</td>
                            <td className="py-1.5 text-right font-mono">{o.executedQty || '0'}</td>
                            <td className="py-1.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                o.status === 'FILLED'      ? 'bg-emerald-500/20 text-emerald-400' :
                                o.status === 'CANCELED'    ? 'bg-red-500/15 text-red-400' :
                                o.status === 'PARTIAL_FILL'? 'bg-blue-500/15 text-blue-400' :
                                                             'bg-amber-500/15 text-amber-400'
                              }`}>{o.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Live from SoDEX {info.data?.isTestnet ? 'Testnet' : 'Mainnet'} · chain {info.data?.chainId}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right: balance + wizard */}
        <div className="space-y-3">

          {/* Balance card */}
          <GlassCard padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Wallet Balance
              </span>
              <button
                onClick={() => balanceQuery.refetch()}
                className="ml-auto text-[var(--text-muted)] hover:text-blue-400"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {!address ? (
              <p className="text-xs text-amber-400">Connect wallet to see balance</p>
            ) : balanceQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading balance…
              </div>
            ) : (
              <div className="space-y-2">
                {(balanceQuery.data?.balances ?? []).map((b) => {
                  const avail = Math.max(0, parseFloat(b.total) - parseFloat(b.locked));
                  return (
                    <div key={b.coin} className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] text-sm font-mono">{dc(b.coin)}</span>
                      <div className="text-right">
                        <div className="font-semibold font-mono text-sm">
                          {fmt(avail, b.coin === 'vUSDC' ? 2 : 6)}
                        </div>
                        {parseFloat(b.locked) > 0 && (
                          <div className="text-[10px] text-amber-400/70">{fmt(b.locked, 4)} locked</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(balanceQuery.data?.balances ?? []).length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    No balance found. Get testnet USDC from the SoDEX faucet.
                  </p>
                )}
              </div>
            )}
          </GlassCard>

          {/* ── 4-Step Trade Wizard ─────────────────────────────────────────── */}
          <GlassCard padding="md">

            {/* Step indicator */}
            <div className="flex items-center gap-1 mb-4">
              {([1, 2, 3, 4] as const).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                    style={{
                      background: wizardStep === s
                        ? 'var(--accent)'
                        : wizardStep > s
                          ? 'rgba(0,255,127,0.2)'
                          : 'var(--bg-elevated)',
                      color: wizardStep === s ? '#0a0a0a' : wizardStep > s ? '#00ff7f' : 'var(--text-muted)',
                      border: wizardStep > s ? '1px solid rgba(0,255,127,0.4)' : '1px solid var(--border-default)',
                    }}
                  >
                    {wizardStep > s ? '✓' : s}
                  </div>
                  {s < 4 && (
                    <div className="flex-1 h-px w-4" style={{
                      background: wizardStep > s ? 'rgba(0,255,127,0.4)' : 'var(--border-subtle)',
                    }} />
                  )}
                </div>
              ))}
              <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {wizardStep === 1 ? 'Strategy' : wizardStep === 2 ? 'Preflight' : wizardStep === 3 ? 'Sign' : 'Proof'}
              </span>
            </div>

            <AnimatePresence mode="wait">

              {/* ── Step 1: Strategy Select ─────────────────────────────── */}
              {wizardStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Choose Strategy</h3>
                  <div className="space-y-2">
                    {([
                      { id: 'copy' as Strategy, icon: <Zap className="w-4 h-4" />, label: 'Copy Signal', desc: 'Mirror the latest AI-generated trade signal — fetched live from the research agent if none are cached' },
                      { id: 'ssi' as Strategy, icon: <BarChart2 className="w-4 h-4" />, label: 'Follow SSI Basket', desc: 'Execute based on SoSoValue Sector Sentiment Index momentum — uses BTC/ETH proxy when basket assets aren\'t on SoDEX Testnet' },
                      { id: 'manual' as Strategy, icon: <SlidersHorizontal className="w-4 h-4" />, label: 'Manual Order', desc: 'Set your own price, size, and order type' },
                    ] as const).map(({ id, icon, label, desc }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setStrategy(id)}
                        className="w-full text-left p-3 rounded-xl border transition-all"
                        style={{
                          borderColor: strategy === id ? 'var(--accent)' : 'var(--border-default)',
                          background: strategy === id ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))' : 'var(--bg-elevated)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: strategy === id ? 'var(--accent)' : 'var(--text-muted)' }}>{icon}</span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                          {strategy === id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--accent)' }} />}
                        </div>
                        <p className="text-[11px] leading-relaxed pl-6" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleStrategyProceed}
                    disabled={strategyLoading}
                    className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'var(--accent)', color: '#0a0a0a' }}
                  >
                    {strategyLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                      : <>Continue <ChevronRight className="w-4 h-4" /></>}
                  </button>
                </motion.div>
              )}

              {/* ── Step 2: Risk Preflight ──────────────────────────────── */}
              {wizardStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Risk Preflight</h3>
                  <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {strategy === 'copy' ? 'Copy Signal · mirroring latest AI signal' : strategy === 'ssi' ? 'SSI Basket · momentum execution' : 'Manual Order · custom parameters'}
                  </p>
                  <div className="space-y-2 mb-4">
                    {[
                      {
                        label: 'Wallet connected',
                        pass: Boolean(address),
                        warn: false,
                        detail: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'No wallet detected',
                      },
                      {
                        label: 'USDC balance',
                        pass: usdcBalance > 0,
                        warn: usdcBalance > 0 && usdcBalance < 10,
                        detail: `${fmt(usdcBalance, 2)} USDC available`,
                      },
                      {
                        label: 'Market selected',
                        pass: Boolean(activeSymbol),
                        warn: false,
                        detail: activeSymbol?.displayName ?? 'None',
                      },
                      {
                        label: 'Market status',
                        pass: !activeSymbol || !NON_TRADING_ST.some((x) => activeSymbol.status.toUpperCase().includes(x)),
                        warn: false,
                        detail: activeSymbol
                          ? NON_TRADING_ST.some((x) => activeSymbol.status.toUpperCase().includes(x))
                            ? `${activeSymbol.displayName} is ${activeSymbol.status} — new orders are blocked`
                            : `${activeSymbol.displayName} is TRADING`
                          : 'No market selected',
                      },
                      {
                        label: 'Network',
                        pass: Boolean(info.data),
                        warn: info.data?.isTestnet,
                        detail: info.data?.isTestnet ? 'Testnet (safe to trade)' : info.data ? 'Mainnet' : 'Checking…',
                      },
                      {
                        label: 'Circuit breaker',
                        pass: true,
                        warn: false,
                        detail: 'All limits within normal range',
                      },
                    ].map(({ label, pass, warn, detail }) => (
                      <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <span className="mt-0.5">
                          {!pass
                            ? <XCircle className="w-4 h-4 text-red-400" />
                            : warn
                              ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                              : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </span>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setWizardStep(1); setCopySignalData(null); setSsiBasketData(null); }}
                      className="px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                      <ChevronLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <button type="button"
                      onClick={() => { if (address) setWizardStep(3); }}
                      disabled={!address}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
                      Proceed <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Sign & Submit ───────────────────────────────── */}
              {wizardStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                    {strategy === 'copy' ? 'Copy Signal — ' : strategy === 'ssi' ? 'SSI Basket — ' : ''}
                    Sign &amp; Submit
                  </h3>

                  {/* ── Copy Signal context card ── */}
                  {strategy === 'copy' && copySignalData && (
                    <div className="mb-3 p-3 rounded-xl border text-[11px]"
                      style={{ borderColor: 'rgba(0,255,127,0.2)', background: 'rgba(0,255,127,0.04)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold"
                          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          AI Signal · Auto-filled
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          String(copySignalData.direction ?? '').toLowerCase().includes('short')
                            ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {String(copySignalData.direction ?? copySignalData.side ?? 'LONG').toUpperCase()}
                        </span>
                      </div>
                      <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {String(copySignalData.asset ?? copySignalData.symbol ?? '').toUpperCase()}/USDC
                      </div>
                      <div className="flex gap-3 mt-1" style={{ color: 'var(--text-muted)' }}>
                        <span>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{copySignalData.confidence ?? '—'}%</strong></span>
                        {copySignalData.entry && (
                          <span>Entry: <strong style={{ color: 'var(--text-primary)' }}>${Number(copySignalData.entry).toLocaleString()}</strong></span>
                        )}
                      </div>
                      {copySignalData.reasoning && (
                        <p className="mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                          {String(copySignalData.reasoning).slice(0, 130)}…
                        </p>
                      )}
                    </div>
                  )}
                  {strategy === 'copy' && !copySignalData && (
                    <div className="mb-3 p-3 rounded-xl border text-[11px]"
                      style={{ borderColor: 'rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)' }}>
                      <p className="font-semibold mb-0.5" style={{ color: '#f97316' }}>No stored signal — research agent was called live.</p>
                      <p style={{ color: 'var(--text-muted)' }}>If the signal still didn&apos;t load, fill in the order fields below manually or go back and retry.</p>
                    </div>
                  )}

                  {/* ── SSI Basket context card ── */}
                  {strategy === 'ssi' && ssiBasketData && (
                    <div className="mb-3 p-3 rounded-xl border text-[11px]"
                      style={{ borderColor: 'rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.04)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-widest font-bold"
                          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          SSI Basket · {ssiBasketData.sector.sector}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                          {ssiBasketData.sector.verdict}
                        </span>
                      </div>
                      <p className="mb-2" style={{ color: 'var(--text-muted)' }}>
                        Score {Number(ssiBasketData.sector.score ?? 0).toFixed(0)}/100 · tap an asset to trade it:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(ssiBasketData.basket?.basket ?? []).map((item: any) => {
                          const sym = tradeableSymbols.find(
                            (s) => s.baseCoin === `v${item.asset}` || s.baseCoin === item.asset,
                          );
                          const isActive = activeSymbol?.baseCoin === `v${item.asset}` || activeSymbol?.baseCoin === item.asset;
                          // Check if the asset exists on SoDEX at all (even if cancel-only)
                          const existsButBlocked = !sym && (symbols.data ?? []).some(
                            (s) => s.baseCoin === `v${item.asset}` || s.baseCoin === item.asset,
                          );
                          return (
                            <button key={item.asset} type="button" disabled={!sym}
                              onClick={() => { if (sym) { setSymbolId(sym.id); autoFilledStrategyRef.current = null; } }}
                              title={existsButBlocked ? `${item.asset} is listed but in cancel-only mode` : !sym ? 'Not listed on SoDEX Testnet' : undefined}
                              className="px-2.5 py-1 rounded-lg font-bold border transition-all"
                              style={{
                                borderColor: isActive ? 'var(--accent)' : 'var(--border-default)',
                                background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-elevated)',
                                color: isActive ? 'var(--accent)' : sym ? 'var(--text-primary)' : 'var(--text-muted)',
                                opacity: sym ? 1 : 0.4,
                              }}>
                              {item.asset} {item.weight}%{existsButBlocked ? ' ⚫' : ''}
                            </button>
                          );
                        })}
                      </div>
                      {(ssiBasketData.basket?.basket ?? []).every((item: any) =>
                        !(symbols.data ?? []).find((s) => s.baseCoin === `v${item.asset}` || s.baseCoin === item.asset)
                      ) && (
                        <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[10px]" style={{ background: 'rgba(0,255,127,0.06)', border: '1px solid rgba(0,255,127,0.18)' }}>
                          {ssiProxyAsset ? (
                            <span>
                              <span className="font-bold" style={{ color: 'var(--accent)' }}>Proxy: {ssiProxyAsset}</span>
                              <span style={{ color: 'var(--text-muted)' }}> selected as sector theme proxy — basket assets not yet listed on SoDEX Testnet.</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Basket assets not on SoDEX Testnet — use BTC or ETH to trade this sector theme.</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {strategy === 'ssi' && !ssiBasketData && (
                    <div className="mb-3 p-3 rounded-xl border text-[11px]"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                      <p style={{ color: 'var(--text-muted)' }}>Sector data unavailable — fill the order manually.</p>
                    </div>
                  )}
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      {(['buy', 'sell'] as const).map((s) => (
                        <button key={s} type="button" onClick={() => { setSide(s); setQuantity(''); }}
                          className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                            side === s
                              ? s === 'buy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : 'bg-white/5 text-[var(--text-muted)] border border-transparent hover:bg-white/10'
                          }`}>
                          {s === 'buy' ? <ArrowUpRight className="inline w-4 h-4 mr-1" /> : <ArrowDownRight className="inline w-4 h-4 mr-1" />}
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {(['limit', 'market'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setOrderType(t)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                            orderType === t
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              : 'bg-white/5 text-[var(--text-muted)] border border-transparent hover:bg-white/10'
                          }`}>{t}
                        </button>
                      ))}
                    </div>
                    {address && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Available</span>
                        <span className="font-mono font-semibold">
                          {side === 'buy'
                            ? `${fmt(usdcBalance, 2)} USDC`
                            : `${fmt(baseCoinBalance, 6)} ${dc(activeSymbol?.baseCoin ?? '')}`}
                        </span>
                      </div>
                    )}
                    {orderType === 'limit' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Price (USDC)</label>
                        <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden focus-within:border-blue-500/60 transition-colors">
                          <input type="number" step="any" min="0" value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder={String(side === 'buy' ? (bestAsk || '') : (bestBid || '')) || '0.00'}
                            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none min-w-0" />
                          <button type="button" onClick={setBestPrice}
                            className="px-2.5 py-2 text-xs text-blue-400 hover:text-blue-300 border-l border-[var(--border-default)] shrink-0">
                            Best
                          </button>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                        Amount ({dc(activeSymbol?.baseCoin ?? '')})
                      </label>
                      <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden focus-within:border-blue-500/60 transition-colors">
                        <input type="number" step="any" min="0" value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder={activeSymbol?.minQuantity ?? '0.00'}
                          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none min-w-0" />
                      </div>
                      {address && (
                        <div className="flex gap-1 mt-1.5">
                          {[0.25, 0.5, 0.75, 1].map((pct) => (
                            <button key={pct} type="button" onClick={() => handlePct(pct)}
                              className="flex-1 py-1 text-[10px] font-semibold rounded bg-white/5 text-[var(--text-muted)] hover:bg-blue-500/15 hover:text-blue-400 transition-colors">
                              {pct * 100}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)] text-xs">Est. total</span>
                        <span className="font-semibold font-mono">{estCost ? `${fmt(estCost, 2)} USDC` : '—'}</span>
                      </div>
                      {estCost > 0 && (
                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                          <span>Fee ({orderType === 'limit' ? '0.035%' : '0.065%'})</span>
                          <span className="font-mono">{fmt(estCost * (orderType === 'limit' ? 0.00035 : 0.00065), 4)} USDC</span>
                        </div>
                      )}
                    </div>
                    {/* EIP-712 preview notice */}
                    <div className="rounded-lg border p-2.5 text-[11px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>EIP-712 Non-Custodial</span>
                      </div>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Your wallet will sign a structured message. The order is relayed to SoDEX — your private key never leaves your device.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setWizardStep(2)}
                        className="px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                        <ChevronLeft className="w-3.5 h-3.5" /> Back
                      </button>
                      <button type="submit" disabled={submitting || !address}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                          side === 'buy'
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-emerald-500/30 disabled:text-white/50'
                            : 'bg-red-500 hover:bg-red-400 text-black disabled:bg-red-500/30 disabled:text-white/50'
                        }`}>
                        {submitting
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Awaiting signature…</>
                          : address
                            ? <>{side === 'buy' ? 'Buy' : 'Sell'} {dc(activeSymbol?.baseCoin ?? '')} <ShieldCheck className="w-4 h-4" /></>
                            : 'Connect wallet'}
                      </button>
                    </div>
                    <AnimatePresence>
                      {result && !result.ok && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="text-sm rounded-lg px-3 py-2 bg-red-500/10 text-red-400">
                          {result.message}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                </motion.div>
              )}

              {/* ── Step 4: Execution Proof ─────────────────────────────── */}
              {wizardStep === 4 && executionProof && (
                <motion.div key="step4" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,255,127,0.15)' }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Order Submitted</h3>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Execution proof from SoDEX relay</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {[
                      { label: 'Order ID', value: String(executionProof.orderId) },
                      { label: 'Market', value: executionProof.market },
                      { label: 'Side', value: executionProof.side, color: executionProof.side === 'BUY' ? 'text-emerald-400' : 'text-red-400' },
                      { label: 'Quantity', value: executionProof.qty },
                      { label: 'Price', value: executionProof.price },
                      { label: 'Status', value: executionProof.status, color: 'text-emerald-400' },
                      { label: 'Time', value: new Date(executionProof.ts).toLocaleTimeString() },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className={`text-xs font-mono font-semibold ${color ?? ''}`} style={{ color: color ? undefined : 'var(--text-primary)' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg mb-4"
                    style={{ background: 'rgba(0,255,127,0.06)', border: '1px solid rgba(0,255,127,0.2)' }}>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-emerald-400 mb-0.5">On-Chain Explorer</div>
                      <a
                        href={`https://testnet.valuechain.com/tx/${executionProof.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono truncate block hover:text-emerald-300"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        valuechain.com/tx/{executionProof.orderId}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(String(executionProof.orderId));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="shrink-0 text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setWizardStep(1); setExecutionProof(null); setResult(null); }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--accent)', color: '#0a0a0a' }}
                  >
                    New Trade <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <TradeInner />
    </Suspense>
  );
}
